import type { DatabaseSync } from 'node:sqlite';
import { blindIndex, decryptField } from '../crypto/FieldEncryption';

/**
 * Cifrado at-rest de la PII de la ficha del paciente (tabla `patients`).
 *
 * Estas columnas son SOLO-DISPLAY: nunca se consultan por valor (WHERE/ORDER/LIKE/JOIN/strftime),
 * así que es seguro cifrarlas con IV aleatorio (verificado en todo src/). Se DEJAN EN CLARO, a
 * propósito, las columnas que SÍ se consultan por valor: full_name, email, phone (búsqueda y orden),
 * birth_date (filtro de cumpleaños), gender (filtro + GROUP BY), tags_json, archived, *_id.
 *
 * `document_number` es especial: se CIFRA como las demás Y se indexa con `document_hash` (índice
 * ciego HMAC) para poder deduplicar por documento sin guardarlo en claro (ver SqlitePatientDirectory
 * .findDuplicateByDocument). La lista vive aquí como FUENTE ÚNICA: clinicalEncryption la añade al
 * pase de cifrado at-rest + a la exportación de habeas data, y los repos la usan al leer/escribir.
 */
export const ENCRYPTED_PATIENT_PII_COLUMNS = [
  'consultation_reason',
  'emergency_contact_name',
  'emergency_contact_phone',
  'notes',
  'guardian_name',
  'guardian_relationship',
  'guardian_document',
  'current_medication',
  'medical_history',
  'treatment_end_reason',
  'insurance_name',
  'insurance_policy_number',
  'referral_source',
  'custom_fields_json',
  'document_number',
] as const;

/**
 * Descifra IN-PLACE las columnas PII de una fila cruda de `patients` (de un `SELECT *`) y devuelve
 * la misma fila. Tolerante: un valor no cifrado (datos previos, o vacío) se deja tal cual. Llámalo
 * justo después del SELECT, antes de mapear a primitivos.
 */
export function decryptPatientRow<T extends object>(row: T): T {
  const mutable = row as Record<string, unknown>;
  for (const col of ENCRYPTED_PATIENT_PII_COLUMNS) {
    const value = mutable[col];
    if (typeof value === 'string' && value !== '') mutable[col] = decryptField(value);
  }
  return row;
}

/**
 * Índice ciego del documento de identidad: permite deduplicar por documento (igualdad) sin
 * almacenar el número en claro. '' si no hay documento (no se indexa la ausencia).
 */
export function documentBlindIndex(documentNumber: string): string {
  return blindIndex(documentNumber);
}

/**
 * Backfill del `document_hash` de filas EXISTENTES, calculado desde el `document_number` EN CLARO.
 * DEBE correr ANTES de que el pase de cifrado cifre `document_number` (de lo contrario el valor
 * ya sería un blob enc:). Idempotente: solo toca filas con documento en claro y sin hash.
 */
export function backfillPatientDocumentHash(db: DatabaseSync): void {
  const rows = db
    .prepare(
      `SELECT id AS rid, document_number AS doc FROM patients
        WHERE document_number IS NOT NULL AND document_number <> ''
          AND document_number NOT LIKE 'enc:v1:%'
          AND (document_hash IS NULL OR document_hash = '')`,
    )
    .all() as unknown as Array<{ rid: string; doc: string }>;
  const update = db.prepare('UPDATE patients SET document_hash = ? WHERE id = ?');
  for (const row of rows) {
    if (typeof row.doc !== 'string' || row.doc.trim() === '') continue;
    update.run(documentBlindIndex(row.doc), row.rid);
  }
}
