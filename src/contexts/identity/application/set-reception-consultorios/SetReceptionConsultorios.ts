import type { ConsultorioRepository } from '../../domain/repositories/ConsultorioRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import type { ReceptionConsultorioRepository } from '../../domain/repositories/ReceptionConsultorioRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';

export interface SetReceptionConsultoriosInput {
  organizationId: string;
  actorUserId: string;
  /** La cuenta de recepción a editar (debe ser recepción de ESTA organización). */
  assistantUserId: string;
  consultorioIds: string[];
}

/**
 * El org_master cambia el conjunto de consultorios que atiende una recepción de SU
 * organización (consultorios-spec §5). Valida que el actor sea el maestro de la org, que
 * la cuenta YA sea una recepción de esta misma org (no se puede secuestrar la recepción
 * de otra org), y que los consultorios pertenezcan a la org. Exige al menos uno.
 */
export class SetReceptionConsultorios {
  public constructor(
    private readonly reception: ReceptionConsultorioRepository,
    private readonly memberships: OrganizationMembershipRepository,
    private readonly consultorios: ConsultorioRepository,
  ) {}

  public async set(input: SetReceptionConsultoriosInput): Promise<void> {
    await this.assertActorIsMaster(input.actorUserId, input.organizationId);

    const current = await this.reception.scopeFor(input.assistantUserId);
    if (!current || current.organizationId !== input.organizationId) {
      throw new Error('Esa cuenta no es una recepción de esta organización.');
    }

    const consultorioIds = [...new Set(input.consultorioIds.filter(Boolean))];
    if (consultorioIds.length === 0) {
      throw new Error('La recepción debe atender al menos un consultorio.');
    }
    for (const consultorioId of consultorioIds) {
      if (!(await this.consultorios.findByIdInOrganization(consultorioId, input.organizationId))) {
        throw new Error('Algún consultorio no pertenece a esta organización.');
      }
    }

    await this.reception.setConsultorios(input.assistantUserId, input.organizationId, consultorioIds);
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
