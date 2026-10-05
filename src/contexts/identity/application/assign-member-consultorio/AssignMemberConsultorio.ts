import type { ConsultorioRepository } from '../../domain/repositories/ConsultorioRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';
import { MemberNotInOrganizationError } from '../update-member-permissions/MemberNotInOrganizationError';

export interface AssignMemberConsultorioInput {
  organizationId: string;
  actorUserId: string;
  memberUserId: string;
  /** Consultorio destino, o null para quitar al miembro de su consultorio. */
  consultorioId: string | null;
}

/**
 * El maestro asigna (o quita) el consultorio de un miembro. Fase 1: solo guarda
 * la pertenencia, sin aislamiento de datos (ver docs/consultorios-spec.md §6).
 * Valida que el actor sea el org_master de la org, que el miembro pertenezca a
 * esa org y que el consultorio (si no es null) sea de esa misma org.
 */
export class AssignMemberConsultorio {
  public constructor(
    private readonly consultorios: ConsultorioRepository,
    private readonly memberships: OrganizationMembershipRepository,
  ) {}

  public async assign(input: AssignMemberConsultorioInput): Promise<void> {
    await this.assertActorIsMaster(input.actorUserId, input.organizationId);

    if (
      input.consultorioId !== null &&
      !(await this.consultorios.findByIdInOrganization(input.consultorioId, input.organizationId))
    ) {
      throw new Error('El consultorio no pertenece a esta organización.');
    }

    const membership = await this.memberships.findByUserId(input.memberUserId);
    if (!membership || membership.membershipOrganizationId() !== input.organizationId) {
      throw new MemberNotInOrganizationError();
    }

    membership.assignConsultorio(input.consultorioId);
    await this.memberships.save(membership);
  }

  private async assertActorIsMaster(actorUserId: string, organizationId: string): Promise<void> {
    const membership = await this.memberships.findByUserId(actorUserId);
    if (
      !membership ||
      membership.membershipOrganizationId() !== organizationId ||
      membership.toPrimitives().memberRole !== 'master'
    ) {
      throw new NotOrganizationMasterError();
    }
  }
}
