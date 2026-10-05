'use server';

import { revalidatePath } from 'next/cache';
import { getFileStorage } from '@/shared/infrastructure/files/getFileStorage';
import { CreateOrganizationMember } from '@/contexts/identity/application/create-organization-member/CreateOrganizationMember';
import { CreateOrganizationMemberMessage } from '@/contexts/identity/application/create-organization-member/CreateOrganizationMemberMessage';
import { UpdateMemberPermissions } from '@/contexts/identity/application/update-member-permissions/UpdateMemberPermissions';
import { UpdateMemberPermissionsMessage } from '@/contexts/identity/application/update-member-permissions/UpdateMemberPermissionsMessage';
import { SetMemberActiveStatus } from '@/contexts/identity/application/set-member-active-status/SetMemberActiveStatus';
import { SetMemberActiveStatusMessage } from '@/contexts/identity/application/set-member-active-status/SetMemberActiveStatusMessage';
import { bumpSessionEpoch } from '@/shared/infrastructure/auth/session';
import { CreateSupervisionLink } from '@/contexts/identity/application/create-supervision-link/CreateSupervisionLink';
import { CreateSupervisionLinkMessage } from '@/contexts/identity/application/create-supervision-link/CreateSupervisionLinkMessage';
import { CreateConsultorio } from '@/contexts/identity/application/create-consultorio/CreateConsultorio';
import { AssignMemberConsultorio } from '@/contexts/identity/application/assign-member-consultorio/AssignMemberConsultorio';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { UpdateOrganizationBranding } from '@/contexts/identity/application/update-organization-branding/UpdateOrganizationBranding';
import { UpdateOrganizationBrandingMessage } from '@/contexts/identity/application/update-organization-branding/UpdateOrganizationBrandingMessage';
import type { MembershipPermissionsPrimitives } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { ScryptPasswordHasher } from '@/contexts/identity/infrastructure/ScryptPasswordHasher';
import { SqliteUserAccountRepository } from '@/contexts/identity/infrastructure/persistence/SqliteUserAccountRepository';
import { SqliteSubscriptionRepository } from '@/contexts/identity/infrastructure/persistence/SqliteSubscriptionRepository';
import { SqliteOrganizationRepository } from '@/contexts/identity/infrastructure/persistence/SqliteOrganizationRepository';
import { SqliteOrganizationMembershipRepository } from '@/contexts/identity/infrastructure/persistence/SqliteOrganizationMembershipRepository';
import { SqliteSupervisionLinkRepository } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisionLinkRepository';
import { SqliteConsultorioRepository } from '@/contexts/identity/infrastructure/persistence/SqliteConsultorioRepository';
import { SqliteProfileProvisioner } from '@/contexts/identity/infrastructure/persistence/SqliteProfileProvisioner';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { isAccessPolicy } from '@/contexts/identity/domain/value-objects/accessPolicy';
import { ReassignPatient } from '@/contexts/patients/application/reassign-patient/ReassignPatient';
import { ReassignDepartingPatients } from '@/contexts/patients/application/offboard-member/ReassignDepartingPatients';
import { SqlitePatientOwnerWriter } from '@/contexts/patients/infrastructure/persistence/SqlitePatientOwnerWriter';
import { SqlitePatientAssignmentRepository } from '@/contexts/patients/infrastructure/persistence/SqlitePatientAssignmentRepository';
import { SqliteInstitutionalPatientReader } from '@/contexts/patients/infrastructure/persistence/SqliteInstitutionalPatientReader';
import { SqliteSupervisorReader } from '@/contexts/identity/infrastructure/persistence/SqliteSupervisorReader';
import {
  requireOrgMaster,
  listOrganizationMembers,
  removeSupervisionLink,
  revokeSupervisionLinksForMember,
} from './orgData';
import { RETAIN_IN_INSTITUTION } from './expedientes/constants';

/**
 * Server actions del hub de organización. TODAS pasan por requireOrgMaster()
 * (guard de sesión + rol) y por los casos de uso de identity, que vuelven a
 * verificar que el actor sea el maestro de ESA organización.
 */

function membershipRepo() {
  return new SqliteOrganizationMembershipRepository();
}

/** Lee los permisos de membresía desde los campos del formulario. */
function permissionsFromForm(formData: FormData): MembershipPermissionsPrimitives {
  const checked = (name: string) => formData.get(name) === 'on' || formData.get(name) === '1';
  const retention = Number(formData.get('retentionPercent') ?? 0);
  return {
    canCharge: checked('canCharge'),
    retentionPercent: Number.isFinite(retention) ? retention : 0,
    forceAppPayments: checked('forceAppPayments'),
    paymentsDisabled: checked('paymentsDisabled'),
    canSupervisePatients: checked('canSupervisePatients'),
    canConfigurePayments: checked('canConfigurePayments'),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// ============================ Miembros ============================

export interface CreateMemberState {
  ok?: boolean;
  error?: string;
  /** Se muestra UNA sola vez; el maestro debe compartirla con el miembro. */
  temporaryPassword?: string;
  memberEmail?: string;
  memberName?: string;
}

export async function createMemberAction(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    const message = new CreateOrganizationMemberMessage({
      organizationId: organization.id,
      actorUserId: userId,
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? ''),
      memberRole: String(formData.get('memberRole') ?? 'psychologist'),
      permissions: permissionsFromForm(formData),
    });
    const useCase = new CreateOrganizationMember(
      new SqliteUserAccountRepository(),
      new SqliteSubscriptionRepository(),
      membershipRepo(),
      new SqliteProfileProvisioner(),
      new ScryptPasswordHasher(),
    );
    const created = await useCase.create(message);
    revalidatePath('/organizacion/miembros');
    revalidatePath('/organizacion');
    return {
      ok: true,
      temporaryPassword: created.temporaryPassword,
      memberEmail: message.emailValue(),
      memberName: message.fullName(),
    };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo crear la cuenta del miembro.') };
  }
}

export interface UpdatePermissionsState {
  ok?: boolean;
  error?: string;
}

export async function updateMemberPermissionsAction(
  memberUserId: string,
  _prev: UpdatePermissionsState,
  formData: FormData,
): Promise<UpdatePermissionsState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    await new UpdateMemberPermissions(membershipRepo()).update(
      new UpdateMemberPermissionsMessage({
        organizationId: organization.id,
        actorUserId: userId,
        memberUserId,
        permissions: permissionsFromForm(formData),
      }),
    );
    revalidatePath('/organizacion/miembros');
    revalidatePath('/organizacion');
    return { ok: true };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudieron guardar los permisos.') };
  }
}

export async function setMemberActiveAction(memberUserId: string, active: boolean): Promise<void> {
  const { userId, organization } = await requireOrgMaster();
  await new SetMemberActiveStatus(new SqliteUserAccountRepository(), membershipRepo()).set(
    new SetMemberActiveStatusMessage({
      organizationId: organization.id,
      actorUserId: userId,
      memberUserId,
      active,
    }),
  );
  // SEG-4: desactivar revoca el acceso → sus sesiones vigentes dejan de valer de inmediato.
  if (!active) await bumpSessionEpoch(memberUserId);
  revalidatePath('/organizacion/miembros');
  revalidatePath('/organizacion');
}

// ============================ Supervisión ============================

export interface CreateLinkState {
  ok?: boolean;
  error?: string;
}

export async function createSupervisionLinkAction(
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    await new CreateSupervisionLink(
      membershipRepo(),
      new SqliteSupervisionLinkRepository(),
      () => organization.consultorioMode,
    ).create(
      new CreateSupervisionLinkMessage({
        organizationId: organization.id,
        actorUserId: userId,
        supervisorUserId: String(formData.get('supervisorUserId') ?? ''),
        supervisedUserId: String(formData.get('supervisedUserId') ?? ''),
        scope: {
          notas: formData.get('scopeNotas') === 'on',
          historias: formData.get('scopeHistorias') === 'on',
          pagos: formData.get('scopePagos') === 'on',
        },
      }),
    );
    revalidatePath('/organizacion/supervision');
    return { ok: true };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo crear el vínculo de supervisión.') };
  }
}

export async function removeSupervisionLinkAction(linkId: string): Promise<void> {
  const { organization } = await requireOrgMaster();
  await removeSupervisionLink(organization.id, linkId);
  revalidatePath('/organizacion/supervision');
}

// ============================ Consultorios (§2) ============================

function consultorioRepo() {
  return new SqliteConsultorioRepository();
}

export interface ConsultorioState {
  ok?: boolean;
  error?: string;
}

/**
 * Crea un consultorio (sub-unidad opcional). Fase 1: solo estructura, sin
 * aislamiento. La org y el actor se resuelven en el servidor (requireOrgMaster);
 * el caso de uso vuelve a verificar que el actor sea el maestro de ESA org.
 */
export async function createConsultorioAction(
  _prev: ConsultorioState,
  formData: FormData,
): Promise<ConsultorioState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    await new CreateConsultorio(consultorioRepo(), membershipRepo()).create({
      organizationId: organization.id,
      actorUserId: userId,
      name: String(formData.get('name') ?? ''),
    });
    revalidatePath('/organizacion/consultorios');
    revalidatePath('/organizacion/miembros');
    return { ok: true };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo crear el consultorio.') };
  }
}

/**
 * Asigna (o quita, con consultorioId = '') el consultorio de un miembro. El
 * memberUserId va atado en el servidor (bind); la org/actor desde requireOrgMaster.
 */
export async function assignMemberConsultorioAction(
  memberUserId: string,
  formData: FormData,
): Promise<void> {
  const { userId, organization } = await requireOrgMaster();
  const raw = String(formData.get('consultorioId') ?? '').trim();
  await new AssignMemberConsultorio(consultorioRepo(), membershipRepo()).assign({
    organizationId: organization.id,
    actorUserId: userId,
    memberUserId,
    consultorioId: raw === '' ? null : raw,
  });
  revalidatePath('/organizacion/miembros');
  revalidatePath('/organizacion/consultorios');
}

/**
 * Cambia el MODO de consultorios de la organización (Modo Sedes, MS1):
 * 'aislado' = cada consultorio es un muro clínico; 'compartido' = sedes/ubicaciones que
 * COMPARTEN la lista de pacientes (apaga el aislamiento por consultorio). Solo el maestro.
 */
export async function setConsultorioModeAction(mode: 'aislado' | 'compartido'): Promise<void> {
  const { organization } = await requireOrgMaster();
  const normalized = mode === 'compartido' ? 'compartido' : 'aislado';
  await getDatabaseAdapter().execute('UPDATE organizations SET consultorio_mode = ? WHERE id = ?', [
    normalized,
    organization.id,
  ]);
  revalidatePath('/organizacion/consultorios');
}

// ============================ Recepción multi-consultorio (§5) ============================

/** Habilita/deshabilita la recepción multi-consultorio para la organización del maestro. */
export async function setReceptionEnabledAction(enabled: boolean): Promise<void> {
  const { organization } = await requireOrgMaster();
  await getDatabaseAdapter().execute(
    'UPDATE organizations SET reception_multi_consultorio = ? WHERE id = ?',
    [enabled ? 1 : 0, organization.id],
  );
  revalidatePath('/organizacion/recepcion');
}

export interface CreateReceptionState {
  ok?: boolean;
  error?: string;
  /** Se muestra UNA sola vez; el maestro la comparte con la recepción. */
  temporaryPassword?: string;
  receptionEmail?: string;
  receptionName?: string;
}

/** El maestro crea una cuenta de recepción ligada a N consultorios de su organización. */
export async function createReceptionAction(
  _prev: CreateReceptionState,
  formData: FormData,
): Promise<CreateReceptionState> {
  const { userId, organization } = await requireOrgMaster();
  const fullName = String(formData.get('fullName') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const consultorioIds = formData.getAll('consultorioId').map((value) => String(value)).filter(Boolean);
  try {
    const created = await createIdentityUseCases().createReception.create({
      organizationId: organization.id,
      actorUserId: userId,
      fullName,
      email,
      consultorioIds,
    });
    revalidatePath('/organizacion/recepcion');
    return {
      ok: true,
      temporaryPassword: created.temporaryPassword,
      receptionEmail: email,
      receptionName: fullName,
    };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo crear la cuenta de recepción.') };
  }
}

/** El maestro cambia el conjunto de consultorios de una recepción (memberUserId atado en el servidor). */
export async function setReceptionConsultoriosAction(
  assistantUserId: string,
  formData: FormData,
): Promise<void> {
  const { userId, organization } = await requireOrgMaster();
  const consultorioIds = formData.getAll('consultorioId').map((value) => String(value)).filter(Boolean);
  await createIdentityUseCases().setReceptionConsultorios.set({
    organizationId: organization.id,
    actorUserId: userId,
    assistantUserId,
    consultorioIds,
  });
  revalidatePath('/organizacion/recepcion');
}

// ============================ Branding ============================

const LOGO_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export interface BrandingState {
  ok?: boolean;
  error?: string;
}

export async function updateBrandingAction(
  _prev: BrandingState,
  formData: FormData,
): Promise<BrandingState> {
  const { userId, organization } = await requireOrgMaster();

  let logoPath: string | undefined;
  const storage = getFileStorage();
  const logo = formData.get('logo');
  if (logo instanceof File && logo.size > 0) {
    const extension = LOGO_EXTENSIONS[logo.type];
    if (!extension) {
      return { error: 'Formato de logo no soportado. Usa PNG, JPG, WebP o SVG.' };
    }
    if (logo.size > MAX_LOGO_BYTES) {
      return { error: 'El logo no puede pesar más de 2 MB.' };
    }
    const key = `orgs/${organization.id}/logo-${Date.now()}${extension}`;
    await storage.save(key, new Uint8Array(await logo.arrayBuffer()));
    logoPath = key;
  }

  const rawSlug = String(formData.get('slug') ?? '').trim();
  try {
    await new UpdateOrganizationBranding(new SqliteOrganizationRepository(), membershipRepo()).update(
      new UpdateOrganizationBrandingMessage({
        organizationId: organization.id,
        actorUserId: userId,
        slug: rawSlug === '' ? undefined : rawSlug,
        logoPath,
      }),
    );
  } catch (error) {
    // Si la base no aceptó el cambio, el logo anterior sigue siendo el vigente.
    // Limpiamos solo el archivo nuevo para no dejar la organización sin imagen.
    if (logoPath) await storage.delete(logoPath).catch(() => undefined);
    return { error: errorMessage(error, 'No se pudo guardar el branding.') };
  }
  // La base ya apunta al nuevo archivo: ahora sí es seguro retirar el anterior.
  if (logoPath && organization.logoPath && organization.logoPath !== logoPath) {
    await storage.delete(organization.logoPath).catch(() => undefined);
  }
  revalidatePath('/organizacion/branding');
  revalidatePath('/organizacion', 'layout');
  return { ok: true };
}

/**
 * Servicio sin costo (v3 §3): al activarse, TODOS los miembros quedan con
 * pagos deshabilitados, la página pública de reservas no muestra precios ni
 * botón de pago y el onboarding de los miembros salta el paso de pago.
 */
export async function setFreeServiceAction(enabled: boolean): Promise<BrandingState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    await new UpdateOrganizationBranding(new SqliteOrganizationRepository(), membershipRepo()).update(
      new UpdateOrganizationBrandingMessage({
        organizationId: organization.id,
        actorUserId: userId,
        freeService: enabled,
      }),
    );
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo actualizar el servicio sin costo.') };
  }
  revalidatePath('/organizacion/branding');
  revalidatePath('/organizacion/liquidacion');
  revalidatePath('/organizacion', 'layout');
  return { ok: true };
}

/**
 * Propiedad institucional de los expedientes (cuentas institucionales §1): cuando
 * se activa, los pacientes NUEVOS se crean bajo la organización con asignación de
 * tratante. No reescribe pacientes existentes (su organization_id no cambia).
 * UPDATE acotado al maestro de ESA organización (guard + WHERE master_user_id).
 */
export async function setPatientOwnershipAction(institutional: boolean): Promise<BrandingState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    await getDatabaseAdapter().execute(
      'UPDATE organizations SET patient_ownership = ? WHERE id = ? AND master_user_id = ?',
      [institutional ? 'institucion' : 'individual', organization.id, userId],
    );
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo actualizar la propiedad de los expedientes.') };
  }
  revalidatePath('/organizacion/branding');
  revalidatePath('/organizacion', 'layout');
  return { ok: true };
}

/**
 * Preset base de acceso entre miembros (§2.2). Lo fija la institución; el profesor
 * solo puede ampliar si professor_can_widen está activo. No concede acceso por sí
 * mismo: lo consume el resolutor de cobertura (H5b). UPDATE acotado al maestro.
 */
export async function setAccessPolicyAction(preset: string): Promise<BrandingState> {
  const { userId, organization } = await requireOrgMaster();
  const value = isAccessPolicy(preset) ? preset : 'estricto';
  try {
    await getDatabaseAdapter().execute(
      'UPDATE organizations SET access_policy = ? WHERE id = ? AND master_user_id = ?',
      [value, organization.id, userId],
    );
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo actualizar la política de acceso.') };
  }
  revalidatePath('/organizacion/branding');
  return { ok: true };
}

export async function setProfessorCanWidenAction(enabled: boolean): Promise<BrandingState> {
  const { userId, organization } = await requireOrgMaster();
  try {
    await getDatabaseAdapter().execute(
      'UPDATE organizations SET professor_can_widen = ? WHERE id = ? AND master_user_id = ?',
      [enabled ? 1 : 0, organization.id, userId],
    );
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo actualizar el ajuste del profesor.') };
  }
  revalidatePath('/organizacion/branding');
  return { ok: true };
}

/**
 * Reasigna un expediente institucional (§1.2, §3.3): cambia el tratante (acceso vivo)
 * o lo retiene en la institución, sin tocar la propiedad. Reusa ReassignPatient, que
 * mueve owner_user_id y supersede la asignación viva. El nuevo tratante debe ser miembro
 * de la organización (o RETAIN_IN_INSTITUTION). Guard: solo el maestro de ESA org.
 */
export async function reassignPatientAction(patientId: string, target: string): Promise<BrandingState> {
  const { userId, organization } = await requireOrgMaster();
  const retain = target === RETAIN_IN_INSTITUTION;
  if (!retain) {
    const members = await listOrganizationMembers(organization.id);
    if (!members.some((member) => member.userId === target && member.status === 'activo')) {
      return { error: 'El tratante debe ser un miembro activo de la organización.' };
    }
  }
  const tratanteUserId = retain ? null : target;
  // Supervisor del nuevo tratante (su vínculo activo en esta org), si lo hay.
  const supervisorUserId = tratanteUserId
    ? await new SqliteSupervisorReader().findActiveSupervisor(tratanteUserId, organization.id)
    : null;
  try {
    // Atómico: mover owner_user_id + supersede asignación + crear la nueva, o nada.
    const result = await getDatabaseAdapter().transaction(() =>
      new ReassignPatient(
        new SqlitePatientOwnerWriter(),
        new SqlitePatientAssignmentRepository(organization.id),
      ).execute({
        patientId,
        organizationId: organization.id,
        tratanteUserId,
        institutionUserId: userId, // el maestro es el custodio institucional (§3.3)
        supervisorUserId,
        assignedBy: userId,
        reason: 'manual',
      }),
    );
    if (!result.ok) return { error: 'No se pudo reasignar: el expediente no es de esta organización.' };
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo reasignar el expediente.') };
  }
  revalidatePath('/organizacion/expedientes');
  return { ok: true };
}

export interface OffboardState {
  ok?: boolean;
  error?: string;
  summary?: string;
}

/**
 * Da de baja a un miembro (cuentas institucionales §3): "desactivar, no borrar" +
 * reasignar. (1) Reasigna TODA su cartera institucional a su supervisor activo o, si
 * no hay, a la institución (ningún paciente huérfano). (2) Desactiva la cuenta (los
 * datos se retienen bajo la institución). En cuentas individuales no hay cartera
 * institucional que reasignar: solo desactiva. Guard: maestro de ESA org; no al maestro.
 */
export async function offboardMemberAction(memberUserId: string): Promise<OffboardState> {
  const { userId, organization } = await requireOrgMaster();
  const member = (await listOrganizationMembers(organization.id)).find((m) => m.userId === memberUserId);
  if (!member) return { error: 'El miembro no pertenece a la organización.' };
  if (member.memberRole === 'master') {
    return { error: 'No se puede dar de baja al maestro de la organización.' };
  }

  let reassignedCount = 0;
  let target: 'supervisor' | 'institucion' = 'institucion';
  try {
    // ATÓMICO (revisión adversarial §3): reasignar TODA la cartera + desactivar van
    // en UNA transacción. Si la desactivación o cualquier reasignación falla, se hace
    // ROLLBACK y NADA queda a medias (ni cartera parcial, ni miembro activo con
    // pacientes movidos). O todo o nada.
    const result = await getDatabaseAdapter().transaction(async () => {
      // 1. Reasignar la cartera (la lectura es por dueño operativo en patients).
      const reassigned = await new ReassignDepartingPatients(
        new SqliteInstitutionalPatientReader(),
        new SqlitePatientOwnerWriter(),
        new SqlitePatientAssignmentRepository(organization.id),
        new SqliteSupervisorReader(),
      ).execute({
        organizationId: organization.id,
        leavingUserId: memberUserId,
        institutionUserId: userId, // el maestro es el custodio institucional (§3.3)
        actorUserId: userId,
      });

      // 2. Desactivar, no borrar (revoca el acceso; los datos se retienen).
      // SetMemberActiveStatus es de identity (ahora ASYNC): se await dentro de la transacción.
      await new SetMemberActiveStatus(new SqliteUserAccountRepository(), membershipRepo()).set(
        new SetMemberActiveStatusMessage({
          organizationId: organization.id,
          actorUserId: userId,
          memberUserId,
          active: false,
        }),
      );
      // SEG-4: rota el epoch dentro de la transacción → sus cookies vigentes mueren al
      // confirmar el offboarding (atómico con la baja; si revierte, también revierte).
      await bumpSessionEpoch(memberUserId);

      // 3. Revocar sus vínculos de supervisión (entrantes y salientes): su
      // supervisor deja de leer su material, y él deja de supervisar a otros.
      await revokeSupervisionLinksForMember(memberUserId);
      return reassigned;
    });
    reassignedCount = result.reassignedCount;
    target = result.target;
  } catch (error) {
    return { error: errorMessage(error, 'No se pudo dar de baja al miembro.') };
  }

  revalidatePath('/organizacion/miembros');
  revalidatePath('/organizacion/expedientes');
  revalidatePath('/organizacion');
  const targetLabel = target === 'supervisor' ? 'su supervisor activo' : 'la institución';
  const carteraMsg =
    reassignedCount === 0
      ? 'Sin expedientes institucionales que reasignar.'
      : `${reassignedCount} ${reassignedCount === 1 ? 'expediente reasignado' : 'expedientes reasignados'} a ${targetLabel}.`;
  return { ok: true, summary: `${carteraMsg} Miembro desactivado.` };
}

export async function removeLogoAction(): Promise<void> {
  const { userId, organization } = await requireOrgMaster();
  await new UpdateOrganizationBranding(new SqliteOrganizationRepository(), membershipRepo()).update(
    new UpdateOrganizationBrandingMessage({
      organizationId: organization.id,
      actorUserId: userId,
      logoPath: null,
    }),
  );
  if (organization.logoPath) await getFileStorage().delete(organization.logoPath);
  revalidatePath('/organizacion/branding');
  revalidatePath('/organizacion', 'layout');
}
