import { randomUUID } from 'node:crypto';
import { Consultorio } from '../../domain/Consultorio';
import type { ConsultorioRepository } from '../../domain/repositories/ConsultorioRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';

export interface CreateConsultorioInput {
  organizationId: string;
  actorUserId: string;
  name: string;
}

/**
 * El maestro de la organización crea un consultorio (sub-unidad opcional).
 * Solo lo puede ejecutar el org_master de ESA organización. Fase 1: solo
 * guarda la estructura, sin aislamiento (ver docs/consultorios-spec.md §6).
 */
export class CreateConsultorio {
  public constructor(
    private readonly consultorios: ConsultorioRepository,
    private readonly memberships: OrganizationMembershipRepository,
  ) {}

  public async create(input: CreateConsultorioInput): Promise<Consultorio> {
    await this.assertActorIsMaster(input.actorUserId, input.organizationId);

    const name = input.name.trim();
    if (!name) throw new Error('El nombre del consultorio es obligatorio.');

    const consultorio = Consultorio.create(randomUUID(), input.organizationId, name);
    await this.consultorios.save(consultorio);
    return consultorio;
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
