import { redirect } from 'next/navigation';
import type { SessionContext } from '@/contexts/identity/application/get-session-context/SessionContext';
import { PaymentConfigurationNotAllowedError } from '@/contexts/identity/domain/errors/PaymentConfigurationNotAllowedError';
import { PaymentsDisabledByMembershipError } from '@/contexts/identity/domain/errors/PaymentsDisabledByMembershipError';
import { MembershipPermissions } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { PatientInInstitutionalCustodyIsReadOnlyError } from '@/contexts/patients/domain/errors/PatientInInstitutionalCustodyIsReadOnlyError';
import { PatientNotFoundError } from '@/contexts/patients/domain/errors/PatientNotFoundError';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { isInstitutionalCustody } from './institutionalCustody';
import { getSessionUserId } from './session';
import { isDesktopEdition } from '../config/desktopEdition';

/**
 * Choke point de las server actions del área privada. Replica en servidor el
 * gate del layout: sesión válida, cuenta activa y suscripción vigente.
 *
 * Una suscripción ausente no se interpreta aquí como vencida: miembros
 * cubiertos por una organización y cuentas administrativas pueden no tener
 * suscripción propia. Esa excepción ya forma parte del read model de sesión.
 */
export async function requireActiveAppSessionContext(): Promise<SessionContext> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido') redirect('/login');
  if (!isDesktopEdition() && context.subscription?.expired) redirect('/suscripcion');
  return context;
}

/** Variante nullable para route handlers que deben responder 401/403 sin redirect HTML. */
export async function getActiveAppSessionContext(): Promise<SessionContext | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido' || (!isDesktopEdition() && context.subscription?.expired)) return null;
  return context;
}

export async function requireActiveAppSessionUserId(): Promise<string> {
  return (await requireActiveAppSessionContext()).userId;
}

function contextHasActiveAppAccess(context: SessionContext): boolean {
  if (context.status === 'suspendido') return false;
  if (isDesktopEdition()) return true;
  if (context.subscription) return !context.subscription.expired;
  // Miembros institucionales pueden estar cubiertos por su organización sin
  // suscripción propia. Admin tampoco depende de un plan individual.
  return context.organization !== null || context.role === 'admin';
}

/** Gate por dueño para páginas/actions públicas de agenda. */
export async function ownerHasActiveAppAccess(ownerUserId: string): Promise<boolean> {
  const context = await createIdentityUseCases().getSessionContext.get(ownerUserId);
  return context ? contextHasActiveAppAccess(context) : false;
}

async function paymentPermissionsForOwner(ownerUserId: string): Promise<MembershipPermissions | null> {
  const context = await createIdentityUseCases().getSessionContext.get(ownerUserId);
  if (!context || !contextHasActiveAppAccess(context)) return null;
  return MembershipPermissions.fromPrimitives(context.permissions);
}

/** Consulta server-side para reservas/checkouts públicos; falla cerrado. */
export async function ownerCanActuallyCharge(ownerUserId: string): Promise<boolean> {
  const permissions = await paymentPermissionsForOwner(ownerUserId);
  return permissions?.canActuallyCharge() ?? false;
}

/** Módulo de pagos visible/legible para el actor actual, incluido un asistente del titular. */
export async function requirePaymentModuleOwnerUserId(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.role === 'professor') redirect('/supervision');
  const permissions = await paymentPermissionsForOwner(context.dataOwnerUserId);
  if (!permissions || permissions.paymentsAreDisabled()) {
    throw new PaymentsDisabledByMembershipError();
  }
  return context.dataOwnerUserId;
}

/** Escrituras/cobros: además del módulo visible, exige capacidad efectiva de cobrar. */
export async function requirePaymentWriteOwnerUserId(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.role === 'professor') redirect('/supervision');
  const permissions = await paymentPermissionsForOwner(context.dataOwnerUserId);
  if (!permissions || !permissions.canActuallyCharge()) {
    throw new PaymentsDisabledByMembershipError();
  }
  return context.dataOwnerUserId;
}

/** Configuración de tarifas/políticas/pasarelas: nunca se hereda al asistente. */
export async function requirePaymentConfigurationAccess(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.isAssistant) redirect(context.isReception ? '/recepcion' : '/agenda');
  if (context.role === 'professor') redirect('/configuracion');
  const permissions = MembershipPermissions.fromPrimitives(context.permissions);
  if (!permissions.canConfigurePayments()) throw new PaymentConfigurationNotAllowedError();
  return context.userId;
}

/** Decisión server-side para formularios mixtos: permite preservar la parte financiera. */
export async function sessionCanConfigurePayments(): Promise<boolean> {
  const context = await requireActiveAppSessionContext();
  if (context.isAssistant || context.role === 'professor') return false;
  return MembershipPermissions.fromPrimitives(context.permissions).canConfigurePayments();
}

/**
 * Lectura clínica propia: un assistant/recepción nunca obtiene el id de su
 * titular y un profesor usa exclusivamente las vistas de supervisión.
 */
export async function requireClinicalRecordAccessUserId(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.isAssistant) redirect(context.isReception ? '/recepcion' : '/pacientes?aviso=expediente');
  if (context.role === 'professor') redirect('/supervision');
  return context.userId;
}

export async function assertPatientNotInInstitutionalCustody(
  patientId: string,
  ownerUserId: string,
): Promise<void> {
  // La comprobación de propiedad debe ocurrir antes que custodia. La consulta
  // de custodia devuelve false para ids ajenos/inexistentes; sin este choke
  // point una action podía crear hijos clínicos con un patientId de otro tenant.
  const owned = await getDatabaseAdapter().queryRow<{ id: string }>(
    'SELECT id FROM patients WHERE id = ? AND owner_user_id = ? LIMIT 1',
    [patientId, ownerUserId],
  );
  if (!owned) throw new PatientNotFoundError(patientId);
  if (await isInstitutionalCustody(patientId, ownerUserId)) {
    throw new PatientInInstitutionalCustodyIsReadOnlyError(patientId);
  }
}

export interface PatientOperationalWriteContext {
  sessionUserId: string;
  ownerUserId: string;
  isAssistant: boolean;
}

/** Alta/contacto de pacientes: el asistente opera como su titular. */
export async function requirePatientOperationalAccessContext(): Promise<PatientOperationalWriteContext> {
  const context = await requireActiveAppSessionContext();
  if (context.role === 'professor') redirect('/supervision');
  return {
    sessionUserId: context.userId,
    ownerUserId: context.dataOwnerUserId,
    isAssistant: context.isAssistant,
  };
}

/** Escritura operativa permitida al titular o su asistente, salvo custodia. */
export async function requirePatientOperationalWriteContext(
  patientId: string,
): Promise<PatientOperationalWriteContext> {
  const context = await requirePatientOperationalAccessContext();
  await assertPatientNotInInstitutionalCustody(patientId, context.ownerUserId);
  return context;
}

export async function requirePatientOperationalWriteAccess(patientId: string): Promise<string> {
  return (await requirePatientOperationalWriteContext(patientId)).ownerUserId;
}

/** Escritura clínica propia + veto duro de ruptura de cristal/custodia. */
export async function requireClinicalRecordWriteAccess(patientId: string): Promise<string> {
  const ownerUserId = await requireClinicalRecordAccessUserId();
  await assertPatientNotInInstitutionalCustody(patientId, ownerUserId);
  return ownerUserId;
}

/**
 * Resolución del dueño de datos (v3 §4): si el usuario es un asistente/
 * recepcionista devuelve el id de su titular (los datos operativos — agenda,
 * pagos, mensajes, pacientes — son DEL titular); para cualquier otro rol
 * devuelve su propio id. Función pura respecto a la sesión: testeable.
 */
export async function resolveDataOwnerUserId(sessionUserId: string): Promise<string> {
  const row = await getDatabaseAdapter().queryRow<{ owner_user_id: string }>(
    `SELECT a.owner_user_id
         FROM assistants a
         JOIN users u ON u.id = a.assistant_user_id
        WHERE a.assistant_user_id = ? AND u.role = 'assistant'`,
    [sessionUserId],
  );
  return row?.owner_user_id ?? sessionUserId;
}

/** ¿La cuenta tiene rol asistente? (guards de Marketing, IA y configuración). */
export async function isAssistantUser(sessionUserId: string): Promise<boolean> {
  const row = await getDatabaseAdapter().queryRow<{ role?: string }>(
    'SELECT role FROM users WHERE id = ?',
    [sessionUserId],
  );
  return row?.role === 'assistant';
}

/** Alcance de una recepción multi-consultorio (consultorios-spec §5). */
export interface ReceptionContext {
  organizationId: string;
  consultorioIds: string[];
  /** La organización tiene habilitada la recepción multi-consultorio (reception_multi_consultorio = 1). */
  enabled: boolean;
}

/**
 * Si la sesión es una RECEPCIÓN (cuenta role='assistant' con filas en
 * `reception_consultorios`), devuelve su organización, sus consultorios y si la org la
 * tiene habilitada; null si no es una recepción. A diferencia del asistente 1:1, la
 * recepción NO resuelve un dueño único: agenda por profesional destino validado (§5).
 */
export async function receptionContext(sessionUserId: string): Promise<ReceptionContext | null> {
  const db = getDatabaseAdapter();
  const rows = await db.query<{ organization_id: string; consultorio_id: string }>(
    'SELECT organization_id, consultorio_id FROM reception_consultorios WHERE assistant_user_id = ?',
    [sessionUserId],
  );
  if (rows.length === 0) return null;
  const organizationId = rows[0].organization_id;
  const org = await db.queryRow<{ flag?: number }>(
    'SELECT reception_multi_consultorio AS flag FROM organizations WHERE id = ?',
    [organizationId],
  );
  return {
    organizationId,
    consultorioIds: rows.map((row) => row.consultorio_id),
    enabled: (org?.flag ?? 0) === 1,
  };
}

/**
 * ¿La cuenta es una recepción multi-consultorio ACTIVA? = tiene consultorios Y la org
 * la tiene habilitada. Exige `enabled` a propósito: así, si el maestro deshabilita la
 * feature (sin borrar los consultorios), esta cuenta deja de tratarse como recepción y
 * NO se la rebota a /recepcion (evita el bucle /recepcion↔/agenda; misma condición que
 * requireReception y que isReception del SessionContext).
 */
export async function isReceptionUser(sessionUserId: string): Promise<boolean> {
  const ctx = await receptionContext(sessionUserId);
  return ctx !== null && ctx.enabled;
}

/**
 * Guard de /recepcion: la sesión debe ser una recepción ACTIVA (cuenta de recepción Y
 * org con la feature habilitada). Si no, regresa a /agenda (un asistente 1:1) o a /login.
 * Devuelve el alcance para acotar todas las lecturas/escrituras a sus consultorios.
 */
export async function requireReception(): Promise<{
  userId: string;
  organizationId: string;
  consultorioIds: string[];
}> {
  const context = await requireActiveAppSessionContext();
  const ctx = await receptionContext(context.userId);
  if (!ctx || !ctx.enabled) redirect('/agenda');
  return { userId: context.userId, organizationId: ctx.organizationId, consultorioIds: ctx.consultorioIds };
}

/** ¿La cuenta tiene rol profesor? (supervisa, no atiende: sin datos operativos propios). */
export async function isProfessorUser(sessionUserId: string): Promise<boolean> {
  const row = await getDatabaseAdapter().queryRow<{ role?: string }>(
    'SELECT role FROM users WHERE id = ?',
    [sessionUserId],
  );
  return row?.role === 'professor';
}

/**
 * Igual que `requireSessionUserId` pero devolviendo el DUEÑO de los datos:
 * el titular cuando la sesión es de un asistente, el propio usuario en
 * cualquier otro caso. Úsalo en las actions/páginas de agenda, pagos,
 * mensajes y datos de contacto de pacientes.
 */
export async function requireDataOwnerUserId(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  // El profesor (supervisa, no atiende) no tiene agenda, pagos ni mensajes propios:
  // su lugar es /supervision. Veda el acceso por URL a esas pantallas y a sus
  // server actions, no solo lo oculta del menú (defensa en profundidad).
  if (context.role === 'professor') redirect('/supervision');
  return context.dataOwnerUserId;
}

/**
 * Guard de páginas vedadas al rol asistente (Marketing, Asistente IA,
 * configuración del titular): si la sesión es de un asistente lo regresa a
 * su agenda. Devuelve el userId de la sesión para encadenar lecturas.
 */
export async function forbidAssistantRole(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.isAssistant) redirect(context.isReception ? '/recepcion' : '/agenda');
  return context.userId;
}

/**
 * Guard de páginas que solo tienen sentido para quien ATIENDE consulta (inicio,
 * pacientes, marketing, asistente IA): si la sesión es de un profesor —que
 * supervisa pero no atiende— lo regresa a /supervision. Complementa al gating del
 * menú con un guard real para el acceso directo por URL. Devuelve el userId de la
 * sesión para encadenar lecturas.
 */
export async function forbidProfessorRole(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.role === 'professor') redirect('/supervision');
  return context.userId;
}

/**
 * Guard de la configuración CLÍNICA (plantillas, consentimiento, agendas,
 * asistentes, integraciones de cobro, recordatorios de pacientes): solo para
 * roles que atienden consulta. El asistente vuelve a su agenda y el profesor
 * (supervisa, no atiende) a la configuración general. Aplica también al
 * acceso directo por URL y a las server actions de esas pantallas.
 */
export async function requireClinicalConfigAccess(): Promise<string> {
  const context = await requireActiveAppSessionContext();
  if (context.isAssistant) redirect(context.isReception ? '/recepcion' : '/agenda');
  if (context.role === 'professor') redirect('/configuracion');
  return context.userId;
}
