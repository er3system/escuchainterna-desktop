import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';
import { MemberNotInOrganizationError } from './MemberNotInOrganizationError';
import { UpdateMemberPermissionsMessage } from './UpdateMemberPermissionsMessage';

/**
 * El maestro de la organización edita los permisos de un miembro
 * (cobros, retención, pagos forzados por app, supervisión, configuración).
 */
export class UpdateMemberPermissions {
  public constructor(private readonly memberships: OrganizationMembershipRepository) {}

  public async update(message: UpdateMemberPermissionsMessage): Promise<void> {
    const actorMembership = await this.memberships.findByUserId(message.actorUserId());
    if (
      !actorMembership ||
      actorMembership.membershipOrganizationId() !== message.organizationId() ||
      actorMembership.toPrimitives().memberRole !== 'master'
    ) {
      throw new NotOrganizationMasterError();
    }

    const membership = await this.memberships.findByUserId(message.memberUserId());
    if (!membership || membership.membershipOrganizationId() !== message.organizationId()) {
      throw new MemberNotInOrganizationError();
    }

    membership.updatePermissions(message.permissions());
    await this.memberships.save(membership);
  }
}
