import { randomUUID } from 'node:crypto';
import { SupervisionLink } from '../../domain/SupervisionLink';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import type { SupervisionLinkRepository } from '../../domain/repositories/SupervisionLinkRepository';
import { sameConsultorio } from '../../domain/value-objects/accessPolicy';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';
import { MemberNotInOrganizationError } from '../update-member-permissions/MemberNotInOrganizationError';
import { SupervisorNotAllowedError } from './SupervisorNotAllowedError';
import { ConsultorioMismatchError } from './ConsultorioMismatchError';
import { CreateSupervisionLinkMessage } from './CreateSupervisionLinkMessage';

/**
 * El maestro crea un vínculo de supervisión dentro de SU organización:
 * ambos usuarios deben ser miembros, y el supervisor debe ser professor
 * o tener el permiso can_supervise_patients. Si el vínculo ya existe,
 * se actualiza su alcance (upsert del repositorio).
 */
export class CreateSupervisionLink {
  public constructor(
    private readonly memberships: OrganizationMembershipRepository,
    private readonly links: SupervisionLinkRepository,
    /**
     * Modo de consultorios de la org (Modo Sedes, MS1). En 'compartido' los consultorios
     * no aíslan, así que NO se rechaza un vínculo "cross-consultorio". Por defecto
     * 'aislado' (comportamiento F4) si no se inyecta.
     */
    private readonly consultorioMode: (organizationId: string) => 'aislado' | 'compartido' = () => 'aislado',
  ) {}

  public async create(message: CreateSupervisionLinkMessage): Promise<string> {
    const actorMembership = await this.memberships.findByUserId(message.actorUserId());
    if (
      !actorMembership ||
      actorMembership.membershipOrganizationId() !== message.organizationId() ||
      actorMembership.toPrimitives().memberRole !== 'master'
    ) {
      throw new NotOrganizationMasterError();
    }

    const supervisorMembership = await this.memberships.findByUserId(message.supervisorUserId());
    const supervisedMembership = await this.memberships.findByUserId(message.supervisedUserId());
    for (const membership of [supervisorMembership, supervisedMembership]) {
      if (!membership || membership.membershipOrganizationId() !== message.organizationId()) {
        throw new MemberNotInOrganizationError();
      }
    }

    const supervisorPrimitives = supervisorMembership!.toPrimitives();
    const supervisorCanSupervise =
      supervisorPrimitives.memberRole === 'professor' ||
      supervisorMembership!.membershipPermissions().canSupervise();
    if (!supervisorCanSupervise) throw new SupervisorNotAllowedError();

    // Aislamiento de consultorio (§3, F4): supervisor y supervisado deben compartir
    // consultorio (o alguno sin consultorio). Un vínculo cross-consultorio no concedería
    // acceso en el enforcement, así que se rechaza aquí para no dejar vínculos muertos.
    // MODO SEDES (MS1): si la org está en 'compartido', los consultorios no aíslan → un
    // vínculo cross-consultorio SÍ es válido, así que no se aplica este guard.
    if (
      this.consultorioMode(message.organizationId()) !== 'compartido' &&
      !sameConsultorio(
        supervisorMembership!.memberConsultorioId(),
        supervisedMembership!.memberConsultorioId(),
      )
    ) {
      throw new ConsultorioMismatchError();
    }

    const link = SupervisionLink.create(
      randomUUID(),
      message.organizationId(),
      message.supervisorUserId(),
      message.supervisedUserId(),
      message.scope(),
    );
    await this.links.save(link);
    return link.toPrimitives().id;
  }
}
