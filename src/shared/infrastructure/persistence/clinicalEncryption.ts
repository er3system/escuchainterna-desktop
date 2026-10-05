import type { DatabaseSync } from 'node:sqlite';
import { encryptField, isEncrypted } from '../crypto/FieldEncryption';
import {
  ENCRYPTED_PATIENT_PII_COLUMNS,
  backfillPatientDocumentHash,
} from './patientPiiEncryption';

/**
 * Pase de arranque del cifrado at-rest: cifra las filas que quedaron en claro
 * ANTES de introducir el cifrado de campos clínicos (v3, sección 1.1).
 *
 * - Idempotente: deja un marker `clinical_encryption` en platform_settings con
 *   la versión aplicada; si ya está al día, no toca nada.
 * - Tolerante: una fila ya cifrada (prefijo enc:v1:) o vacía se salta.
 *
 * Los repos cifran al escribir y descifran al leer a partir de ahora; este
 * pase solo existe para las bases de datos creadas antes del cambio.
 */

const MARKER_KEY = 'clinical_encryption';
// v2: se sumaron 4 columnas clínicas a la lista (patient_notes.body,
// patient_assessments.notes, session_notes.answers_json, case_session_notes.content).
// v3: las notas de las solicitudes de co-firma (report_signature_requests.note y
// .resolution_note) son texto libre que puede contener datos clínicos/identificatorios.
// v4: relational_cases.profile_json (evaluación del sistema, objetivos, eventos y mapa de
// relaciones del caso) es contenido clínico de texto libre.
// v5: PII de la ficha del paciente (patients.*) solo-display: contacto de emergencia, acudiente,
// seguro, historia médica, medicación, motivo de consulta/de fin, origen de derivación, campos
// personalizados y documento de identidad. Antes viajaban EN CLARO en la BD (la auditoría lo marcó:
// una fuga del archivo .db exponía QUIÉN es cada paciente). El documento además se indexa con
// document_hash (ver patientPiiEncryption + migración v55). NO se cifran nombre/email/teléfono ni
// birth_date/gender (se consultan por valor). Subir la versión fuerza el re-barrido idempotente.
// v6: ai_chat_threads.title — el título del hilo del asistente se deriva de los primeros ~60
// caracteres de la PRIMERA PREGUNTA clínica ("¿Cómo manejo la ideación suicida de María…"): es una
// huella clínica, no una etiqueta neutra como los títulos de notas (que siguen en claro a
// propósito, son de búsqueda). El repo no consulta por título (ordena por updated_at), así que
// cifrarlo no rompe nada.
const CURRENT_VERSION = 6;

interface EncryptedColumn {
  table: string;
  column: string;
}

/** Campos clínicos cifrados at-rest (NO títulos ni nombres: son de búsqueda). */
export const ENCRYPTED_CLINICAL_COLUMNS: EncryptedColumn[] = [
  { table: 'session_notes', column: 'content' },
  { table: 'session_notes', column: 'answers_json' },
  { table: 'clinical_records', column: 'answers_json' },
  { table: 'ai_chat_messages', column: 'content' },
  // El título del hilo es un extracto de la primera pregunta clínica (ver nota v6).
  { table: 'ai_chat_threads', column: 'title' },
  { table: 'patient_reports', column: 'content' },
  { table: 'patient_consents', column: 'template_body' },
  { table: 'patient_consents', column: 'signed_name' },
  // Cifradas por sus repos al escribir, pero faltaban en la lista: sin esto, el pase
  // de arranque no saneaba residuos en claro y la exportación de habeas data las
  // volcaba como texto cifrado (no se descifraban). patient_assessments.answers_json
  // (puntajes numéricos) queda en claro a propósito para graficar la tendencia.
  { table: 'patient_notes', column: 'body' },
  { table: 'patient_assessments', column: 'notes' },
  { table: 'case_session_notes', column: 'content' },
  { table: 'report_signature_requests', column: 'note' },
  { table: 'report_signature_requests', column: 'resolution_note' },
  { table: 'relational_cases', column: 'profile_json' },
  // PII solo-display de la ficha del paciente (fuente única en patientPiiEncryption). Incluirlas
  // aquí hace que el pase de arranque cifre los residuos en claro Y que la exportación de habeas
  // data las descifre al volcarlas.
  ...ENCRYPTED_PATIENT_PII_COLUMNS.map((column) => ({ table: 'patients', column })),
];

function appliedVersion(db: DatabaseSync): number {
  const row = db
    .prepare('SELECT value_json FROM platform_settings WHERE key = ?')
    .get(MARKER_KEY) as { value_json: string } | undefined;
  if (!row) return 0;
  try {
    const parsed = JSON.parse(row.value_json) as { version?: number };
    return typeof parsed.version === 'number' ? parsed.version : 0;
  } catch {
    return 0;
  }
}

function encryptColumn(db: DatabaseSync, table: string, column: string): number {
  const rows = db
    .prepare(
      `SELECT id AS rid, ${column} AS value FROM ${table}
        WHERE ${column} <> '' AND ${column} NOT LIKE 'enc:v1:%'`,
    )
    .all() as unknown as Array<{ rid: string; value: string }>;

  const update = db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`);
  let encrypted = 0;
  for (const row of rows) {
    if (typeof row.value !== 'string' || row.value === '' || isEncrypted(row.value)) continue;
    update.run(encryptField(row.value), row.rid);
    encrypted += 1;
  }
  return encrypted;
}

export function encryptExistingClinicalData(db: DatabaseSync): void {
  if (appliedVersion(db) >= CURRENT_VERSION) return;

  db.exec('BEGIN');
  try {
    // ANTES de cifrar: calcula document_hash desde document_number EN CLARO (el loop de abajo lo
    // cifrará justo después). Idempotente.
    backfillPatientDocumentHash(db);
    let total = 0;
    for (const { table, column } of ENCRYPTED_CLINICAL_COLUMNS) {
      total += encryptColumn(db, table, column);
    }
    db.prepare(
      `INSERT INTO platform_settings (key, value_json) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    ).run(
      MARKER_KEY,
      JSON.stringify({ version: CURRENT_VERSION, encryptedAt: new Date().toISOString(), rows: total }),
    );
    db.exec('COMMIT');
    if (total > 0) {
      console.info(`[seguridad] Cifrado at-rest aplicado a ${total} filas clínicas existentes.`);
    }
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
