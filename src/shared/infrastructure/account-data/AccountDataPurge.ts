import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { listOwnerScopedTables } from './AccountDataExport';

/**
 * Supresión de cuenta (habeas data, Ley 1581) CON salvaguarda de retención.
 * La historia clínica tiene retención obligatoria en Colombia, así que el
 * borrado se BLOQUEA si la cuenta aún tiene datos clínicos: primero hay que
 * exportar o transferir la custodia. Solo se purgan cuentas sin esos datos.
 */

/** Tablas clínicas cuya presencia bloquea el borrado (retención obligatoria). */
const CLINICAL_TABLES = [
  'patients',
  'clinical_records',
  'session_notes',
  'diagnoses',
  'patient_reports',
  'patient_files',
  'received_consents',
  // Bitácora privada (v29) y cuestionarios aplicados (v33): también son dato clínico
  // del paciente bajo retención. Sin esto, tras un offboarding institucional quedaban
  // con el dueño saliente y el sweep los borraba en silencio (la salvaguarda no los veía).
  'patient_notes',
  'patient_assessments',
] as const;

export interface ClinicalDataCount {
  patients: number;
  records: number;
  notes: number;
  diagnoses: number;
  reports: number;
  files: number;
  privateNotes: number;
  assessments: number;
  total: number;
}

async function countOwned(table: string, userId: string): Promise<number> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT COUNT(*) AS n FROM ${table} WHERE owner_user_id = ?`,
    [userId],
  )) as { n: number } | null;
  return row?.n ?? 0;
}

/** Cuenta los datos clínicos del dueño (la salvaguarda de retención). */
export async function countClinicalData(userId: string): Promise<ClinicalDataCount> {
  const byTable = new Map<string, number>();
  for (const t of CLINICAL_TABLES) byTable.set(t, await countOwned(t, userId));
  const get = (t: string) => byTable.get(t) ?? 0;
  const total = [...byTable.values()].reduce((sum, n) => sum + n, 0);
  return {
    patients: get('patients'),
    records: get('clinical_records'),
    notes: get('session_notes'),
    diagnoses: get('diagnoses'),
    reports: get('patient_reports'),
    files: get('patient_files') + get('received_consents'),
    privateNotes: get('patient_notes'),
    assessments: get('patient_assessments'),
    total,
  };
}

/** ¿La cuenta es maestra de alguna organización? (No se puede borrar sin transferir.) */
export async function isOrganizationMaster(userId: string): Promise<boolean> {
  return Boolean(
    await getDatabaseAdapter().queryRow(
      'SELECT 1 FROM organizations WHERE master_user_id = ? LIMIT 1',
      [userId],
    ),
  );
}

/**
 * Purga TODOS los datos del dueño + las filas que referencian al usuario + la
 * cuenta. Debe correr DENTRO de withTransaction: si quedara una FK colgando, el
 * borrado de `users` falla y la transacción hace ROLLBACK limpio (nada a medias).
 * Llamar SOLO tras pasar la salvaguarda (sin datos clínicos, no maestro, no admin).
 */
export async function purgeAccountData(userId: string): Promise<void> {
  const db = getDatabaseAdapter();

  const email = (
    (await db.queryRow('SELECT email FROM users WHERE id = ?', [userId])) as { email?: string } | null
  )?.email;

  // 0. ai_chat_messages cuelga de ai_chat_threads por thread_id y NO tiene owner_user_id, así que el
  //    sweep genérico de abajo (que borra los hilos) la dejaría huérfana: residuo de dato clínico
  //    CIFRADO (content ∈ ENCRYPTED_CLINICAL_COLUMNS) tras una supresión de cuenta = habeas data
  //    incompleto (Ley 1581). Se borran los mensajes ANTES de que el sweep borre los hilos.
  await db.execute(
    'DELETE FROM ai_chat_messages WHERE thread_id IN (SELECT id FROM ai_chat_threads WHERE owner_user_id = ?)',
    [userId],
  );

  // 1. Datos por dueño (sweep dinámico: cubre toda tabla con owner_user_id).
  //    Secuencial (NUNCA en paralelo): comparten la única conexión/transacción.
  for (const table of await listOwnerScopedTables()) {
    await db.execute(`DELETE FROM ${table} WHERE owner_user_id = ?`, [userId]);
  }

  // 2. Filas que referencian al usuario por OTRA columna (FK a users(id) y afines).
  //    Orden: todo lo que apunta a users ANTES de borrar la fila de users.
  await db.execute('DELETE FROM organization_memberships WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM supervision_links WHERE supervisor_user_id = ? OR supervised_user_id = ?', [userId, userId]);
  await db.execute('DELETE FROM supervision_session_reviews WHERE supervisor_user_id = ? OR supervised_user_id = ?', [userId, userId]);
  // subscription_payments tiene FK enforced a subscriptions(id) SIN cascada, así que
  // hay que borrar los pagos ANTES que la suscripción; si no, DELETE subscriptions viola
  // la FK, la transacción revierte y la cuenta queda "no borrable".
  await db.execute(
    'DELETE FROM subscription_payments WHERE subscription_id IN (SELECT id FROM subscriptions WHERE user_id = ?)',
    [userId],
  );
  await db.execute('DELETE FROM subscriptions WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM referrals WHERE referrer_user_id = ? OR referred_user_id = ?', [userId, userId]);
  await db.execute('DELETE FROM referral_codes WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM notifications WHERE recipient_user_id = ?', [userId]);
  await db.execute('DELETE FROM user_limit_overrides WHERE user_id = ?', [userId]);
  await db.execute('DELETE FROM assistants WHERE assistant_user_id = ?', [userId]);
  await db.execute('DELETE FROM patient_shares WHERE grantee_user_id = ?', [userId]);
  await db.execute('DELETE FROM practitioner_profile WHERE user_id = ?', [userId]);
  if (email) await db.execute('DELETE FROM login_attempts WHERE email = ?', [email]);

  // 3. La cuenta. La bitácora (admin_audit_log / record_access_log) NO se borra:
  //    es el rastro de auditoría y no tiene FK a users (queda el id como texto).
  await db.execute('DELETE FROM users WHERE id = ?', [userId]);
}
