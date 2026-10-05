import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import { decryptField, isEncrypted } from '../crypto/FieldEncryption';
import { ENCRYPTED_CLINICAL_COLUMNS } from '../persistence/clinicalEncryption';

/**
 * Exportación de TODOS los datos de una cuenta (habeas data, derecho de acceso
 * y portabilidad — Ley 1581). Volcado genérico: recorre toda tabla con columna
 * `owner_user_id` y descifra los campos clínicos cifrados at-rest, de modo que
 * cubre automáticamente cualquier tabla presente y futura sin enumerarlas a mano.
 * Solo debe invocarse desde una superficie gateada por requireAdmin (queda
 * auditado allí). Nunca incluye el hash de contraseña.
 */

export interface AccountDataExport {
  exportedAt: string;
  account: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  subscription: Record<string, unknown> | null;
  memberships: Record<string, unknown>[];
  /** Datos clínicos/operativos del dueño, por tabla (contenido descifrado). */
  ownedData: Record<string, Record<string, unknown>[]>;
}

/** Tablas que tienen columna `owner_user_id` (scope por dueño). */
export async function listOwnerScopedTables(): Promise<string[]> {
  const db = getDatabaseAdapter();
  // La introspección del esquema es específica del motor (mismo selector que
  // getDatabaseAdapter): sqlite_master/PRAGMA son solo-SQLite y LANZAN en Postgres.
  if (process.env.DATABASE_URL) {
    const rows = (await db.query(
      `SELECT DISTINCT table_name AS name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'owner_user_id'`,
    )) as unknown as Array<{ name: string }>;
    return rows.map((r) => r.name);
  }
  const tables = (await db.query(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
  )) as unknown as Array<{ name: string }>;
  const owned: string[] = [];
  for (const { name } of tables) {
    const cols = (await db.query(`PRAGMA table_info(${name})`)) as unknown as Array<{ name: string }>;
    if (cols.some((c) => c.name === 'owner_user_id')) owned.push(name);
  }
  return owned;
}

function encryptedColumnsFor(table: string): string[] {
  return ENCRYPTED_CLINICAL_COLUMNS.filter((c) => c.table === table).map((c) => c.column);
}

function decryptRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
  if (columns.length === 0) return row;
  for (const col of columns) {
    const value = row[col];
    if (typeof value === 'string' && isEncrypted(value)) {
      try {
        row[col] = decryptField(value);
      } catch {
        row[col] = '[no se pudo descifrar]';
      }
    }
  }
  return row;
}

function safeOwnedRow(
  table: string,
  row: Record<string, unknown>,
  encryptedColumns: string[],
): Record<string, unknown> {
  const result = decryptRow(row, encryptedColumns);
  // Las credenciales de terceros no son datos portables de la cuenta y una
  // exportación nunca debe incluir secretos ni sus envelopes cifrados.
  if (table === 'integration_connections') delete result.config_json;
  return result;
}

export async function exportAccountData(userId: string): Promise<AccountDataExport> {
  const db = getDatabaseAdapter();

  const account = (await db.queryRow(
    'SELECT id, email, role, status, created_by, created_at FROM users WHERE id = ?',
    [userId],
  )) as Record<string, unknown> | null;

  const profile = (await db.queryRow('SELECT * FROM practitioner_profile WHERE user_id = ?', [
    userId,
  ])) as Record<string, unknown> | null;

  const subscription = (await db.queryRow('SELECT * FROM subscriptions WHERE user_id = ?', [
    userId,
  ])) as Record<string, unknown> | null;

  const memberships = (await db.query('SELECT * FROM organization_memberships WHERE user_id = ?', [
    userId,
  ])) as unknown as Record<string, unknown>[];

  const ownedData: Record<string, Record<string, unknown>[]> = {};
  for (const table of await listOwnerScopedTables()) {
    const encCols = encryptedColumnsFor(table);
    const rows = (await db.query(`SELECT * FROM ${table} WHERE owner_user_id = ?`, [
      userId,
    ])) as unknown as Record<string, unknown>[];
    if (rows.length === 0) continue;
    ownedData[table] = rows.map((row) => safeOwnedRow(table, row, encCols));
  }

  // ai_chat_messages cuelga de ai_chat_threads por thread_id (sin owner_user_id), así que el sweep
  // genérico de arriba no la alcanza: sin esto el export del titular omitiría el CONTENIDO de sus
  // conversaciones con el asistente (solo saldrían los hilos). El content va cifrado at-rest → se
  // descifra como cualquier otra columna del export para que el dato pueda entregarse completo.
  const chatMessages = (await db.query(
    `SELECT m.* FROM ai_chat_messages m
       JOIN ai_chat_threads t ON t.id = m.thread_id
      WHERE t.owner_user_id = ?`,
    [userId],
  )) as unknown as Record<string, unknown>[];
  if (chatMessages.length > 0) {
    const encCols = encryptedColumnsFor('ai_chat_messages');
    ownedData.ai_chat_messages = chatMessages.map((row) => decryptRow(row, encCols));
  }

  return {
    exportedAt: new Date().toISOString(),
    account: account ?? null,
    profile: profile ?? null,
    subscription: subscription ?? null,
    memberships,
    ownedData,
  };
}
