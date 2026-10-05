import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { MembershipPermissions } from '../../domain/value-objects/MembershipPermissions';
import { isUserRole, type UserRole } from '../../domain/value-objects/UserRole';
import { Subscription, type SubscriptionStatus } from '../../domain/Subscription';
import type { SessionContextReader } from '../../domain/repositories/SessionContextReader';
import type { SessionContext } from '../../application/get-session-context/SessionContext';

interface UserRow {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface ProfileRow {
  full_name: string;
  onboarding_completed: number;
}

interface MembershipRow {
  permissions_json: string;
  member_role: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  org_kind: string;
  org_logo_path: string | null;
  org_free_service: number;
  org_patient_ownership: string;
  org_access_policy: string;
  org_professor_can_widen: number;
  org_reception_multi_consultorio: number;
  org_consultorio_mode: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  trial_ends_at: string;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
}

/** Junta usuario + perfil + membresía/organización + suscripción en una sola lectura. */
export class SqliteSessionContextReader implements SessionContextReader {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async read(userId: string): Promise<SessionContext | null> {
    const user = await this.db.queryRow<UserRow>('SELECT id, email, role, status FROM users WHERE id = ?', [
      userId,
    ]);
    if (!user) return null;

    const profile = await this.db.queryRow<ProfileRow>(
      'SELECT full_name, onboarding_completed FROM practitioner_profile WHERE user_id = ?',
      [userId],
    );

    const membership = await this.db.queryRow<MembershipRow>(
      `SELECT m.permissions_json, m.member_role,
                o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.kind AS org_kind,
                o.logo_path AS org_logo_path, o.free_service AS org_free_service,
                o.patient_ownership AS org_patient_ownership, o.access_policy AS org_access_policy,
                o.professor_can_widen AS org_professor_can_widen,
                o.reception_multi_consultorio AS org_reception_multi_consultorio,
                o.consultorio_mode AS org_consultorio_mode
           FROM organization_memberships m
           JOIN organizations o ON o.id = m.organization_id
          WHERE m.user_id = ?
          ORDER BY m.created_at ASC LIMIT 1`,
      [userId],
    );

    const subscriptionRow = await this.db.queryRow<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE user_id = ?',
      [userId],
    );

    const role: UserRole = isUserRole(user.role) ? user.role : 'psychologist';
    const organizationHasFreeService = membership ? membership.org_free_service === 1 : false;
    // v3 §3 (universidades): si la organización ofrece servicio sin costo,
    // TODOS sus miembros quedan con pagos deshabilitados, manda sobre lo que
    // diga la membresía individual.
    let permissions = membership
      ? MembershipPermissions.fromJson(membership.permissions_json)
      : MembershipPermissions.defaults();
    if (organizationHasFreeService) {
      permissions = MembershipPermissions.fromPrimitives({
        ...permissions.toPrimitives(),
        paymentsDisabled: true,
      });
    }

    // Rol asistente (v3 §4): el dueño de los datos operativos es su titular.
    const assistantLink =
      role === 'assistant'
        ? await this.db.queryRow<{ owner_user_id: string }>(
            'SELECT owner_user_id FROM assistants WHERE assistant_user_id = ?',
            [userId],
          )
        : null;
    const isAssistant = role === 'assistant';
    // Recepción multi-consultorio (§5): un assistant con filas en reception_consultorios
    // Y cuya organización tiene la feature HABILITADA. No tiene titular ni membresía;
    // opera en /recepcion eligiendo profesional destino. Exigir el flag de la org alinea
    // este check con requireReception/isReceptionUser: si el maestro deshabilita la
    // recepción, el menú/home vuelven a los de un assistant normal (sin bucle de ruteo).
    const receptionRow = isAssistant
      ? await this.db.queryRow(
          `SELECT 1 FROM reception_consultorios rc
             JOIN organizations o ON o.id = rc.organization_id
            WHERE rc.assistant_user_id = ? AND o.reception_multi_consultorio = 1 LIMIT 1`,
          [userId],
        )
      : null;
    const isReception = isAssistant && receptionRow !== null;
    const dataOwnerUserId = assistantLink?.owner_user_id ?? user.id;

    const supervisesRow = await this.db.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM supervision_links WHERE supervisor_user_id = ? AND revoked_at IS NULL',
      [userId],
    );
    const supervisesSomeone = (supervisesRow?.n ?? 0) > 0;
    const isSupervisor = role === 'professor' || (permissions.canSupervise() && supervisesSomeone);

    let subscription: SessionContext['subscription'] = null;
    if (subscriptionRow) {
      const aggregate = Subscription.fromPrimitives({
        id: subscriptionRow.id,
        userId: subscriptionRow.user_id,
        plan: subscriptionRow.plan,
        status: subscriptionRow.status as SubscriptionStatus,
        trialEndsAt: subscriptionRow.trial_ends_at,
        currentPeriodEnd: subscriptionRow.current_period_end,
        canceledAt: subscriptionRow.canceled_at,
        createdAt: subscriptionRow.created_at,
      });
      subscription = {
        plan: subscriptionRow.plan,
        status: aggregate.currentStatus(),
        trialEndsAt: subscriptionRow.trial_ends_at,
        currentPeriodEnd: subscriptionRow.current_period_end,
        canceledAt: subscriptionRow.canceled_at,
        expired: aggregate.isExpired(),
        daysLeftInTrial: aggregate.daysLeftInTrial(),
      };
    }

    return {
      userId: user.id,
      email: user.email,
      fullName: profile?.full_name ?? '',
      role,
      status: user.status === 'suspendido' ? 'suspendido' : 'activo',
      onboardingCompleted: profile ? profile.onboarding_completed === 1 : false,
      organization: membership
        ? {
            id: membership.org_id,
            name: membership.org_name,
            slug: membership.org_slug,
            kind: membership.org_kind,
            logoPath: membership.org_logo_path,
            freeService: organizationHasFreeService,
            patientOwnership: membership.org_patient_ownership === 'institucion' ? 'institucion' : 'individual',
            accessPolicy:
              membership.org_access_policy === 'cobertura'
                ? 'cobertura'
                : membership.org_access_policy === 'intermedio'
                  ? 'intermedio'
                  : 'estricto',
            professorCanWiden: membership.org_professor_can_widen === 1,
            receptionMultiConsultorio: membership.org_reception_multi_consultorio === 1,
            consultorioMode: membership.org_consultorio_mode === 'compartido' ? 'compartido' : 'aislado',
          }
        : null,
      permissions: permissions.toPrimitives(),
      isSupervisor,
      isAssistant,
      isReception,
      dataOwnerUserId,
      subscription,
    };
  }
}
