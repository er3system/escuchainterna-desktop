import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { PatientOwnerWriter } from '../../domain/repositories/PatientOwnerWriter';

/**
 * Tablas con (owner_user_id, patient_id) cuyo dueño se MUEVE junto al paciente para
 * que la continuidad sea real (§1: "reasignar el registro vivo"). El nuevo tratante
 * debe ver TODO lo del paciente —clínico y operativo—, no solo la ficha. Lista
 * derivada introspeccionando el esquema (PRAGMA table_info).
 *
 * EXCLUIDAS a propósito: `case_members` y `case_session_notes` (casos relacionales
 * pareja/familia, MULTI-paciente): mover la mitad de un caso compartido lo dejaría con
 * dueño incoherente entre miembros. La reasignación individual NO parte el caso de la
 * pareja; ese proceso conjunto sigue con su tratante. (record_access_log se excluye por
 * ser bitácora acotada por actor, no por dueño.)
 */
const CASCADE_TABLES = [
  // Clínico
  'clinical_records',
  'session_notes',
  'diagnoses',
  'patient_files',
  'patient_reports',
  'family_maps',
  'patient_consents',
  'patient_notes', // bitácora privada del paciente (v29)
  'patient_assessments', // cuestionarios aplicados PHQ-9/GAD-7 (v33)
  'ai_chat_threads',
  // Operativo
  'bookings',
  'invoices',
  'outbox_messages',
] as const;

/**
 * Mueve el DUEÑO operativo de un paciente institucional (§1.2) Y CASCADEA el dueño de
 * todo su dato (clínico + operativo), de forma que el nuevo tratante tenga continuidad
 * completa. Acotado por organización. Pensado para correr DENTRO de una transacción
 * (withTransaction): las múltiples escrituras son atómicas o nada.
 */
export class SqlitePatientOwnerWriter implements PatientOwnerWriter {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async setOwner(
    patientId: string,
    organizationId: string,
    newOwnerUserId: string,
  ): Promise<boolean> {
    // Dueño actual (anterior): solo se reasigna si el paciente es de esta organización.
    const current = await this.db.queryRow<{ owner_user_id: string }>(
      'SELECT owner_user_id FROM patients WHERE id = ? AND organization_id = ?',
      [patientId, organizationId],
    );
    if (!current) return false;
    const previousOwner = current.owner_user_id;

    // 1. La ficha del paciente.
    await this.db.execute(
      'UPDATE patients SET owner_user_id = ? WHERE id = ? AND organization_id = ?',
      [newOwnerUserId, patientId, organizationId],
    );

    // 2. Cascada: todo el dato del paciente que pertenecía al dueño anterior. SECUENCIAL
    // (for..of + await, NUNCA Promise.all): preserva el orden y la atomicidad dentro de la
    // transacción del adaptador abierta por el caller.
    for (const table of CASCADE_TABLES) {
      await this.db.execute(
        `UPDATE ${table} SET owner_user_id = ? WHERE patient_id = ? AND owner_user_id = ?`,
        [newOwnerUserId, patientId, previousOwner],
      );
    }
    return true;
  }

  /**
   * Transfiere un paciente PARTICULAR (sin organización) de un profesional a otro
   * (Ajustes › Transferir). A diferencia de setOwner —que mueve el ACCESO de un
   * expediente institucional sin tocar la propiedad— aquí el paciente sigue siendo
   * particular: solo cambia su dueño. Cascadea TODO el dato (mismo CASCADE_TABLES) para
   * que el colega tenga continuidad completa. Acotado al dueño anterior (no mueve lo que
   * no sea suyo) y exige organization_id NULL (los institucionales van por reasignación).
   * Pensado para correr DENTRO de una transacción (withTransaction).
   */
  public async transferIndividual(
    patientId: string,
    fromOwnerUserId: string,
    toOwnerUserId: string,
  ): Promise<boolean> {
    const current = await this.db.queryRow<{ owner_user_id: string }>(
      'SELECT owner_user_id FROM patients WHERE id = ? AND organization_id IS NULL',
      [patientId],
    );
    // Solo el dueño actual puede cederlo, y solo si es particular.
    if (!current || current.owner_user_id !== fromOwnerUserId) return false;

    await this.db.execute(
      'UPDATE patients SET owner_user_id = ? WHERE id = ? AND owner_user_id = ? AND organization_id IS NULL',
      [toOwnerUserId, patientId, fromOwnerUserId],
    );

    // Cascada SECUENCIAL (for..of + await, NUNCA Promise.all): atómica dentro de la
    // transacción del caller.
    for (const table of CASCADE_TABLES) {
      await this.db.execute(
        `UPDATE ${table} SET owner_user_id = ? WHERE patient_id = ? AND owner_user_id = ?`,
        [toOwnerUserId, patientId, fromOwnerUserId],
      );
    }
    return true;
  }
}
