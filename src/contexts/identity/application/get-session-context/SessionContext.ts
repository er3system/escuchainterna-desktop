import type { UserRole } from '../../domain/value-objects/UserRole';
import type { MembershipPermissionsPrimitives } from '../../domain/value-objects/MembershipPermissions';

/**
 * Read model de sesión que consumen TODAS las páginas privadas:
 * rol, organización, permisos de membresía y estado de suscripción.
 * Tipos puros y serializables (seguros para client components vía `import type`).
 */
export interface SessionOrganization {
  id: string;
  name: string;
  slug: string;
  kind: string;
  logoPath: string | null;
  /**
   * Servicio sin costo (v3 §3, universidades). Cuando es true, el lector de
   * sesión fuerza `permissions.paymentsDisabled = true` para TODOS los
   * miembros: pagos ocultos en la app y sin precios en los flujos públicos.
   */
  freeService: boolean;
  /**
   * Propiedad de los expedientes (cuentas institucionales §1): 'individual' = del
   * profesional (comportamiento por defecto); 'institucion' = de la organización
   * (los pacientes nuevos se crean bajo la org con asignación de tratante).
   */
  patientOwnership: 'individual' | 'institucion';
  /** Preset base de acceso de la institución (§2.2): estricto | intermedio | cobertura. */
  accessPolicy: 'estricto' | 'intermedio' | 'cobertura';
  /** Si el profesor puede ampliar el acceso de sus supervisados (§2.1). */
  professorCanWiden: boolean;
  /** Recepción multi-consultorio habilitada para la organización (consultorios §5). */
  receptionMultiConsultorio: boolean;
  /** Modo de consultorios (Modo Sedes): 'aislado' (muro clínico) | 'compartido' (sedes). */
  consultorioMode: 'aislado' | 'compartido';
}

export interface SessionSubscription {
  /** Plan elegido (id de la tabla `plans`: esencial | profesional | organizacion). */
  plan: string;
  status: 'trial' | 'activa' | 'vencida' | 'cancelada';
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  /** Fecha en que el titular pidió cancelar (al fin de periodo). null = vigente sin cancelar. */
  canceledAt: string | null;
  /** true ⇒ el layout privado redirige a /suscripcion. */
  expired: boolean;
  daysLeftInTrial: number;
}

export interface SessionContext {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: 'activo' | 'suspendido';
  onboardingCompleted: boolean;
  organization: SessionOrganization | null;
  permissions: MembershipPermissionsPrimitives;
  /** professor, o miembro con can_supervise_patients y vínculos vigentes. */
  isSupervisor: boolean;
  /** true ⇒ rol asistente/recepcionista (v3 §4): opera datos del titular, sin expediente clínico. */
  isAssistant: boolean;
  /** true ⇒ es una RECEPCIÓN multi-consultorio (assistant con consultorios; opera en /recepcion). */
  isReception: boolean;
  /**
   * Dueño de los datos operativos: para un asistente es el id de su titular;
   * para cualquier otro rol coincide con `userId`.
   */
  dataOwnerUserId: string;
  subscription: SessionSubscription | null;
}
