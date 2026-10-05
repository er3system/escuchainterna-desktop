import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';

/**
 * Compartir un expediente en SOLO LECTURA con un colega de la misma organización
 * (Ajustes del paciente › Compartir). Migración v24, tabla `patient_shares`.
 *
 * Un "share" es un permiso de lectura EXPLÍCITO, por paciente, otorgado por el
 * tratante (owner_user_id) a un colega (grantee_user_id) de su misma organización.
 * NO cambia la propiedad ni el tratante: el dueño sigue siendo el dueño. El
 * resolutor único de acceso (resolvePatientAccess) lo consume y vuelve a verificar
 * en CADA lectura que el que comparte siga siendo dueño y que ambos sigan en la org
 * (fail-closed). La lectura compartida queda trazada como 'acceso_compartido'.
 *
 * Todas las consultas fallan cerrado: ante cualquier duda no conceden acceso.
 */

/** Concesión viva mínima que necesita el resolutor para acotar la lectura. */
export interface ActiveShareGrant {
  ownerUserId: string;
  organizationId: string;
}

/**
 * ¿Existe una concesión VIVA de este paciente hacia este colega? Devuelve el dueño
 * con el que acotar la lectura y la org del alcance, o null. El resolutor todavía
 * revalida propiedad y membresía: esto es solo el primer filtro.
 */
export async function activeShareForGrantee(
  patientId: string,
  granteeUserId: string,
): Promise<ActiveShareGrant | null> {
  const row = await getDatabaseAdapter().queryRow<{ owner_user_id: string; organization_id: string }>(
    `SELECT owner_user_id, organization_id
         FROM patient_shares
        WHERE patient_id = ? AND grantee_user_id = ? AND revoked_at IS NULL
        ORDER BY created_at DESC
        LIMIT 1`,
    [patientId, granteeUserId],
  );
  if (!row) return null;
  return { ownerUserId: row.owner_user_id, organizationId: row.organization_id };
}

/**
 * ¿`userId` es miembro ACTIVO (no suspendido) de la organización? Se usa para que un
 * share solo conceda acceso mientras AMBOS —quien comparte y quien recibe— sigan en
 * la misma org. Falla cerrado.
 */
export async function isActiveOrgMember(organizationId: string, userId: string): Promise<boolean> {
  const row = await getDatabaseAdapter().queryRow<{ 1: number }>(
    `SELECT 1
         FROM organization_memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? AND m.user_id = ? AND u.status = 'activo'
        LIMIT 1`,
    [organizationId, userId],
  );
  return row !== null;
}

/**
 * Consultorio (sub-unidad intra-org, consultorios §3) al que pertenece un miembro en
 * una organización, o null si no tiene (org_master / org sin consultorios). Lectura
 * transversal para el aislamiento del resolutor de acceso. Falla a null (conservador).
 *
 * MODO SEDES (MS1): si la org está en modo 'compartido', los consultorios son sedes
 * (ubicaciones) y NO aíslan → se devuelve null para que `sameConsultorio` siempre pase.
 * Así el aislamiento por consultorio queda apagado en cobertura/compartir con un solo
 * punto de control (el acceso lo rige entonces la política de la org).
 */
export async function memberConsultorio(organizationId: string, userId: string): Promise<string | null> {
  const row = await getDatabaseAdapter().queryRow<{
    consultorio_id: string | null;
    consultorio_mode: string;
  }>(
    `SELECT m.consultorio_id AS consultorio_id, o.consultorio_mode AS consultorio_mode
         FROM organization_memberships m
         JOIN organizations o ON o.id = m.organization_id
        WHERE m.organization_id = ? AND m.user_id = ? LIMIT 1`,
    [organizationId, userId],
  );
  if (!row || row.consultorio_mode === 'compartido') return null;
  return row.consultorio_id ?? null;
}

/** Una concesión viva, con los datos del colega receptor (para la UI del dueño). */
export interface PatientShareGrant {
  id: string;
  granteeUserId: string;
  granteeName: string;
  granteeEmail: string;
  createdAt: string;
}

/** Concesiones vivas de ESTE paciente otorgadas por ESTE dueño (vista del dueño). */
export async function listActiveSharesOfOwner(
  patientId: string,
  ownerUserId: string,
): Promise<PatientShareGrant[]> {
  const rows = await getDatabaseAdapter().query<{
    id: string;
    grantee_user_id: string;
    created_at: string;
    grantee_email: string;
    grantee_name: string;
  }>(
    `SELECT s.id, s.grantee_user_id, s.created_at,
              u.email AS grantee_email,
              COALESCE(NULLIF(p.full_name, ''), u.email) AS grantee_name
         FROM patient_shares s
         JOIN users u ON u.id = s.grantee_user_id
         LEFT JOIN practitioner_profile p ON p.user_id = s.grantee_user_id
        WHERE s.patient_id = ? AND s.owner_user_id = ? AND s.revoked_at IS NULL
        ORDER BY s.created_at DESC`,
    [patientId, ownerUserId],
  );
  return rows.map((row) => ({
    id: row.id,
    granteeUserId: row.grantee_user_id,
    granteeName: row.grantee_name,
    granteeEmail: row.grantee_email,
    createdAt: row.created_at,
  }));
}

/** Un expediente compartido CONMIGO (vista del colega receptor). */
export interface SharedWithMePatient {
  id: string;
  fullName: string;
  ownerName: string;
  archived: boolean;
}

/**
 * Expedientes que me han compartido (descubrimiento para el colega receptor). Espeja
 * las verificaciones del resolutor —concesión viva, quien comparte SIGUE siendo dueño,
 * y ambos siguen ACTIVOS en la misma organización— pero SIN registrar acceso: esto es
 * solo una lista, no abrir el expediente (la traza 'acceso_compartido' la deja el
 * resolutor al entrar). Si por una desincronización un ítem no se pudiera abrir, el
 * resolutor lo protege igual (404). Los asistentes nunca son receptores.
 */
export async function listPatientsSharedWithMe(granteeUserId: string): Promise<SharedWithMePatient[]> {
  const rows = await getDatabaseAdapter().query<{
    id: string;
    full_name: string;
    archived: number;
    owner_name: string;
  }>(
    `SELECT p.id, p.full_name, p.archived,
              COALESCE(NULLIF(po.full_name, ''), uo.email) AS owner_name
         FROM patient_shares s
         JOIN patients p
           ON p.id = s.patient_id AND p.owner_user_id = s.owner_user_id
         JOIN users ug
           ON ug.id = s.grantee_user_id AND ug.status = 'activo'
         JOIN organization_memberships mg
           ON mg.organization_id = s.organization_id AND mg.user_id = s.grantee_user_id
         JOIN users uo
           ON uo.id = s.owner_user_id AND uo.status = 'activo'
         JOIN organization_memberships mo
           ON mo.organization_id = s.organization_id AND mo.user_id = s.owner_user_id
         LEFT JOIN practitioner_profile po ON po.user_id = s.owner_user_id
        WHERE s.grantee_user_id = ? AND s.revoked_at IS NULL
        ORDER BY LOWER(p.full_name) ASC`,
    [granteeUserId],
  );
  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    ownerName: row.owner_name,
    archived: row.archived !== 0,
  }));
}

/**
 * Crea una concesión de lectura. Idempotente: si ya hay una viva para (paciente,
 * colega) no inserta otra (el índice único parcial también lo impediría). La
 * VALIDACIÓN (que el dueño realmente posea el paciente, que el colega sea miembro
 * activo de la misma org y no sea uno mismo) se hace en la server action ANTES de
 * llamar aquí.
 */
export async function createPatientShare(input: {
  patientId: string;
  ownerUserId: string;
  granteeUserId: string;
  organizationId: string;
  createdBy: string;
}): Promise<void> {
  const existing = await activeShareForGrantee(input.patientId, input.granteeUserId);
  if (existing) return;
  await getDatabaseAdapter().execute(
    `INSERT INTO patient_shares
         (id, patient_id, owner_user_id, grantee_user_id, organization_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.patientId,
      input.ownerUserId,
      input.granteeUserId,
      input.organizationId,
      input.createdBy,
      new Date().toISOString(),
    ],
  );
}

/**
 * Revoca una concesión. Solo el DUEÑO que la otorgó puede revocarla (se exige que
 * `owner_user_id` coincida): un colega no puede borrar su propio rastro de acceso.
 */
export async function revokePatientShare(shareId: string, ownerUserId: string): Promise<void> {
  await getDatabaseAdapter().execute(
    `UPDATE patient_shares SET revoked_at = ?
        WHERE id = ? AND owner_user_id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), shareId, ownerUserId],
  );
}

/**
 * Revoca TODAS las concesiones vivas que este dueño otorgó sobre este paciente. Se
 * usa al archivar/quitar el paciente: si el dueño lo saca de su consulta, deja de
 * tener sentido que un colega lo siga viendo.
 */
export async function revokeAllSharesOfPatient(patientId: string, ownerUserId: string): Promise<void> {
  await getDatabaseAdapter().execute(
    `UPDATE patient_shares SET revoked_at = ?
        WHERE patient_id = ? AND owner_user_id = ? AND revoked_at IS NULL`,
    [new Date().toISOString(), patientId, ownerUserId],
  );
}
