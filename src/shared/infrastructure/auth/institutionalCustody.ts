import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { logRecordAccess, type RecordAccessArea } from '@/shared/infrastructure/audit/recordAccessLog';

/**
 * ¿El paciente está en CUSTODIA institucional para este dueño? (cuentas
 * institucionales §3.3).
 *
 * Es verdadero cuando `ownerUserId` posee la ficha como CUSTODIO y no como
 * tratante: el paciente es institucional (organization_id) y su asignación VIVA no
 * tiene tratante (`tratante_user_id IS NULL`), situación que se produce cuando un
 * miembro se da de baja SIN supervisor activo y su cartera queda retenida por la
 * institución. En ese caso el dueño operativo es una cuenta administrativa
 * (org_master) que NO es el tratante real del paciente.
 *
 * Leer el contenido clínico de un paciente en custodia es un acceso de RUPTURA DE
 * CRISTAL (break-glass): se PERMITE (decisión de producto), pero NUNCA en silencio
 * — debe quedar trazado como 'acceso_cobertura' (habeas data, §2.3), igual que
 * cualquier acceso que no sea el del propio tratante.
 *
 * Lectura puramente de custodia (no expone datos clínicos). Falla cerrado: ante
 * cualquier duda devuelve false (se trata como propiedad normal y las demás guardas
 * siguen aplicando).
 */
export async function isInstitutionalCustody(patientId: string, ownerUserId: string): Promise<boolean> {
  const row = await getDatabaseAdapter().queryRow<{ 1: number }>(
    `SELECT 1
         FROM patients p
         JOIN patient_assignments a
           ON a.patient_id = p.id AND a.organization_id = p.organization_id
        WHERE p.id = ? AND p.owner_user_id = ?
          AND p.organization_id IS NOT NULL
          AND a.status != 'reasignada'
          AND a.tratante_user_id IS NULL
        LIMIT 1`,
    [patientId, ownerUserId],
  );
  return row !== null;
}

/**
 * Si el paciente está en custodia institucional para este dueño, deja la traza
 * obligatoria de ruptura de cristal ('acceso_cobertura'). No hace nada en caso
 * contrario. Pensada para las superficies que leen/sirven contenido clínico FUERA del
 * layout del expediente (server actions, route handlers de descarga, motor de IA por
 * nota), donde el guard del layout no llega a registrar el acceso.
 */
export async function auditCustodyAccess(
  ownerUserId: string,
  patientId: string,
  area: RecordAccessArea,
): Promise<void> {
  if (await isInstitutionalCustody(patientId, ownerUserId)) {
    await logRecordAccess(ownerUserId, patientId, area, 'acceso_cobertura');
  }
}
