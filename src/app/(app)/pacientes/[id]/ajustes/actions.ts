'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireClinicalRecordWriteAccess } from '@/shared/infrastructure/auth/dataOwner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { SqlitePatientRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientRepository';
import { ArchivePatient } from '@/contexts/patients/application/archive-patient/ArchivePatient';
import { ReassignPatient } from '@/contexts/patients/application/reassign-patient/ReassignPatient';
import { SqlitePatientOwnerWriter } from '@/contexts/patients/infrastructure/persistence/SqlitePatientOwnerWriter';
import { SqlitePatientAssignmentRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientAssignmentRepository';
import {
  createPatientShare,
  revokePatientShare,
  revokeAllSharesOfPatient,
  isActiveOrgMember,
  memberConsultorio,
} from '@/shared/infrastructure/auth/patientShares';
import { sameConsultorio } from '@/contexts/identity/domain/value-objects/accessPolicy';
import { ownerOrganizationId } from './sharing';

/**
 * Ajustes del paciente. Se acotan al DUEÑO en sesión (el tratante): se usa
 * requireSessionUserId (no resolveDataOwnerUserId) para que un asistente no pueda
 * tocar la configuración de los pacientes de su titular.
 */
export async function updateReminderPrefsAction(
  patientId: string,
  whatsapp: boolean,
  email: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const repo = new SqlitePatientRepository(ownerUserId);
  const patient = await repo.findById(patientId);
  if (!patient) return { ok: false, error: 'Paciente no encontrado.' };
  patient.setReminderPreferences(whatsapp, email);
  await repo.save(patient);
  revalidatePath(`/pacientes/${patientId}/ajustes`);
  return { ok: true };
}

async function orgMasterUserId(organizationId: string): Promise<string | null> {
  const row = (await getDatabaseAdapter().queryRow(
    'SELECT master_user_id FROM organizations WHERE id = ?',
    [organizationId],
  )) as { master_user_id: string | null } | null;
  return row?.master_user_id ?? null;
}

/** Nombre legible de un usuario (perfil o, en su defecto, correo). */
async function userDisplayName(userId: string): Promise<string> {
  const row = (await getDatabaseAdapter().queryRow(
    `SELECT COALESCE(NULLIF(p.full_name, ''), u.email) AS name
         FROM users u LEFT JOIN practitioner_profile p ON p.user_id = u.id
        WHERE u.id = ?`,
    [userId],
  )) as { name: string } | null;
  return row?.name ?? 'Un miembro del equipo';
}

/** Inserta un aviso in-app (campana). */
async function insertNotification(input: {
  recipientUserId: string;
  kind: 'novedad' | 'aviso_org';
  title: string;
  body: string;
  link: string;
  patientId: string;
  createdBy: string;
}): Promise<void> {
  await getDatabaseAdapter().execute(
    `INSERT INTO notifications (id, recipient_user_id, kind, title, body, link, patient_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      input.recipientUserId,
      input.kind,
      input.title,
      input.body,
      input.link,
      input.patientId,
      input.createdBy,
      new Date().toISOString(),
    ],
  );
}

/** Aviso in-app al maestro: un miembro devolvió su paciente a la institución. */
async function notifyMasterPatientReleased(
  masterUserId: string,
  releasedByUserId: string,
  patientId: string,
  patientName: string,
): Promise<void> {
  await insertNotification({
    recipientUserId: masterUserId,
    kind: 'aviso_org',
    title: 'Paciente devuelto a la institución',
    body: `${await userDisplayName(releasedByUserId)} quitó de su consulta al paciente «${patientName}». Queda bajo custodia de la institución hasta que lo reasignes.`,
    link: '/organizacion/expedientes',
    patientId,
    createdBy: releasedByUserId,
  });
}

/** Aviso al colega: recibió un paciente (su expediente completo). */
async function notifyColleaguePatientTransferred(
  granteeUserId: string,
  fromUserId: string,
  patientId: string,
  patientName: string,
): Promise<void> {
  await insertNotification({
    recipientUserId: granteeUserId,
    kind: 'novedad',
    title: 'Se te transfirió un paciente',
    body: `${await userDisplayName(fromUserId)} te transfirió el expediente de «${patientName}». Ahora es tu paciente.`,
    link: `/pacientes/${patientId}`,
    patientId,
    createdBy: fromUserId,
  });
}

/** Aviso al maestro: un miembro transfirió un expediente institucional a otro. */
async function notifyMasterPatientTransferred(
  masterUserId: string,
  fromUserId: string,
  toUserId: string,
  patientId: string,
  patientName: string,
): Promise<void> {
  await insertNotification({
    recipientUserId: masterUserId,
    kind: 'aviso_org',
    title: 'Paciente transferido entre miembros',
    body: `${await userDisplayName(fromUserId)} transfirió el expediente de «${patientName}» a ${await userDisplayName(toUserId)}.`,
    link: '/organizacion/expedientes',
    patientId,
    createdBy: fromUserId,
  });
}

/**
 * "Eliminar paciente" del Ajustes: NUNCA borra datos.
 * - Cuenta individual (sin organización): archiva (recuperable desde la lista).
 * - Cuenta institucional: el miembro se lo quita y queda bajo CUSTODIA de la
 *   institución (tratante NULL), avisando al maestro para que lo reasigne.
 */
export async function deletePatientAction(
  patientId: string,
): Promise<{ ok: boolean; mode?: 'archived' | 'unassigned'; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const repo = new SqlitePatientRepository(ownerUserId);
  const patient = await repo.findById(patientId);
  if (!patient) return { ok: false, error: 'Paciente no encontrado.' };
  const organizationId = patient.owningOrganizationId();

  // Individual → archivar (recuperable). Si tenía concesiones de lectura vivas, se
  // revocan: si lo sacas de tu consulta, deja de tener sentido que un colega lo vea.
  if (organizationId === null) {
    try {
      await new ArchivePatient(repo).archive(patientId);
      await revokeAllSharesOfPatient(patientId, ownerUserId);
    } catch {
      return { ok: false, error: 'No se pudo archivar el paciente.' };
    }
    revalidatePath('/pacientes');
    return { ok: true, mode: 'archived' };
  }

  // Institucional → devolver a la institución + avisar al maestro.
  const masterUserId = await orgMasterUserId(organizationId);
  if (!masterUserId) {
    return { ok: false, error: 'La organización no tiene un responsable configurado.' };
  }
  if (masterUserId === ownerUserId) {
    return {
      ok: false,
      error: 'Eres el responsable de la organización: reasigna este paciente desde Organización › Expedientes.',
    };
  }

  const patientName = patient.toPrimitives().fullName;
  try {
    await getDatabaseAdapter().transaction(async () => {
      await new ReassignPatient(
        new SqlitePatientOwnerWriter(),
        new SqlitePatientAssignmentRepository(organizationId),
      ).execute({
        patientId,
        organizationId,
        tratanteUserId: null,
        institutionUserId: masterUserId,
        supervisorUserId: null,
        assignedBy: ownerUserId,
        reason: 'offboarding',
      });
      await notifyMasterPatientReleased(masterUserId, ownerUserId, patientId, patientName);
    });
  } catch {
    return { ok: false, error: 'No se pudo quitar el paciente de tu consulta.' };
  }
  revalidatePath('/pacientes');
  return { ok: true, mode: 'unassigned' };
}

/**
 * Comparte el expediente en SOLO LECTURA con un colega de la MISMA organización
 * (Ajustes › Compartir). No cambia la propiedad ni el tratante: es un permiso de
 * lectura del resumen, revocable y trazado ('acceso_compartido' en el resolutor).
 * Se valida AQUÍ que el actor sea el dueño, que pertenezca a una org y que el colega
 * sea un miembro activo de esa misma org (≠ uno mismo); el resolutor revalida en cada
 * lectura.
 */
export async function shareReadOnlyAction(
  patientId: string,
  granteeUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const patient = await new SqlitePatientRepository(ownerUserId).findById(patientId);
  if (!patient) return { ok: false, error: 'Paciente no encontrado.' };

  if (!granteeUserId || granteeUserId === ownerUserId) {
    return { ok: false, error: 'Elige un colega distinto de ti.' };
  }
  const organizationId = await ownerOrganizationId(ownerUserId);
  if (!organizationId) {
    return {
      ok: false,
      error: 'Compartir está disponible para equipos: no perteneces a ninguna organización.',
    };
  }
  if (!(await isActiveOrgMember(organizationId, granteeUserId))) {
    return { ok: false, error: 'Ese colega no es un miembro activo de tu organización.' };
  }
  // Aislamiento de consultorio (§3): no se comparte cruzando consultorios (el resolutor
  // ya lo bloquea en lectura; aquí evitamos crear el share muerto y el aviso engañoso).
  if (
    !sameConsultorio(
      await memberConsultorio(organizationId, ownerUserId),
      await memberConsultorio(organizationId, granteeUserId),
    )
  ) {
    return { ok: false, error: 'Ese colega pertenece a otro consultorio.' };
  }

  await createPatientShare({
    patientId,
    ownerUserId,
    granteeUserId,
    organizationId,
    createdBy: ownerUserId,
  });
  // Privacidad: el aviso NO nombra al paciente. Si el dueño se equivoca de colega y
  // revoca, el enlace ya está protegido por el resolutor (404 tras revocar), así que el
  // colega nunca llega a ver de quién se trataba. El nombre se revela al abrir el enlace.
  await insertNotification({
    recipientUserId: granteeUserId,
    kind: 'novedad',
    title: 'Te compartieron un expediente',
    body: `${await userDisplayName(ownerUserId)} te dio acceso de lectura a un expediente. Ábrelo para verlo.`,
    link: `/pacientes/${patientId}`,
    patientId,
    createdBy: ownerUserId,
  });
  revalidatePath(`/pacientes/${patientId}/ajustes`);
  return { ok: true };
}

/** Revoca una concesión de lectura. Solo el dueño que la otorgó puede revocarla. */
export async function revokeShareAction(
  patientId: string,
  shareId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  // Confirma propiedad del paciente antes de tocar sus concesiones.
  const patient = await new SqlitePatientRepository(ownerUserId).findById(patientId);
  if (!patient) return { ok: false, error: 'Paciente no encontrado.' };
  await revokePatientShare(shareId, ownerUserId);
  revalidatePath(`/pacientes/${patientId}/ajustes`);
  return { ok: true };
}

/**
 * "Transferir" el paciente a un colega de la MISMA organización: CEDE el paciente (el
 * dueño actual pierde el acceso). Irreversible desde aquí (el colega podría devolverlo).
 * - Particular (sin org): cambia el dueño y cascadea TODO su expediente al colega.
 * - Institucional: reasigna el tratante dentro de la organización (la propiedad sigue
 *   siendo de la institución) y avisa al maestro.
 * En ambos casos se revocan las concesiones de lectura del dueño anterior y se avisa al
 * colega. Acotado al dueño en sesión; el colega debe ser miembro activo de la org.
 */
export async function transferPatientAction(
  patientId: string,
  granteeUserId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ownerUserId = await requireClinicalRecordWriteAccess(patientId);
  const patient = await new SqlitePatientRepository(ownerUserId).findById(patientId);
  if (!patient) return { ok: false, error: 'Paciente no encontrado.' };

  if (!granteeUserId || granteeUserId === ownerUserId) {
    return { ok: false, error: 'Elige un colega distinto de ti.' };
  }
  const orgId = await ownerOrganizationId(ownerUserId);
  if (!orgId) {
    return {
      ok: false,
      error: 'Transferir está disponible para equipos: no perteneces a ninguna organización.',
    };
  }
  if (!(await isActiveOrgMember(orgId, granteeUserId))) {
    return { ok: false, error: 'Ese colega no es un miembro activo de tu organización.' };
  }
  // Aislamiento de consultorio (§3): no se transfiere la cartera cruzando consultorios
  // (mover el paciente a otro consultorio movería sus datos fuera de la frontera).
  if (
    !sameConsultorio(
      await memberConsultorio(orgId, ownerUserId),
      await memberConsultorio(orgId, granteeUserId),
    )
  ) {
    return { ok: false, error: 'Ese colega pertenece a otro consultorio.' };
  }

  const organizationId = patient.owningOrganizationId();
  const patientName = patient.toPrimitives().fullName;

  // Particular → cambia de dueño y cascadea el expediente.
  if (organizationId === null) {
    try {
      await getDatabaseAdapter().transaction(async () => {
        const moved = await new SqlitePatientOwnerWriter().transferIndividual(
          patientId,
          ownerUserId,
          granteeUserId,
        );
        if (!moved) throw new Error('no-move');
        await revokeAllSharesOfPatient(patientId, ownerUserId);
        await notifyColleaguePatientTransferred(granteeUserId, ownerUserId, patientId, patientName);
      });
    } catch {
      return { ok: false, error: 'No se pudo transferir el paciente.' };
    }
    revalidatePath('/pacientes');
    return { ok: true };
  }

  // Institucional → reasigna el tratante dentro de la organización (sin tocar propiedad).
  if (organizationId !== orgId) {
    return { ok: false, error: 'Este expediente pertenece a otra organización.' };
  }
  const masterUserId = await orgMasterUserId(organizationId);
  if (!masterUserId) {
    return { ok: false, error: 'La organización no tiene un responsable configurado.' };
  }
  try {
    await getDatabaseAdapter().transaction(async () => {
      await new ReassignPatient(
        new SqlitePatientOwnerWriter(),
        new SqlitePatientAssignmentRepository(organizationId),
      ).execute({
        patientId,
        organizationId,
        tratanteUserId: granteeUserId,
        institutionUserId: masterUserId,
        supervisorUserId: null,
        assignedBy: ownerUserId,
        reason: 'reasignacion',
      });
      await revokeAllSharesOfPatient(patientId, ownerUserId);
      await notifyColleaguePatientTransferred(granteeUserId, ownerUserId, patientId, patientName);
      await notifyMasterPatientTransferred(masterUserId, ownerUserId, granteeUserId, patientId, patientName);
    });
  } catch {
    return { ok: false, error: 'No se pudo transferir el paciente.' };
  }
  revalidatePath('/pacientes');
  return { ok: true };
}
