import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';
import { MemberNotInOrganizationError } from '../update-member-permissions/MemberNotInOrganizationError';
import { CannotDeactivateMasterError } from './CannotDeactivateMasterError';
import { SetMemberActiveStatusMessage } from './SetMemberActiveStatusMessage';

/**
 * Desactiva (suspende) o reactiva la cuenta de un miembro de la organización.
 * Una cuenta suspendida no puede iniciar sesión (gate del layout privado).
 */
export class SetMemberActiveStatus {
  public constructor(
    private readonly accounts: UserAccountRepository,
    private readonly memberships: OrganizationMembershipRepository,
  ) {}

  public async set(message: SetMemberActiveStatusMessage): Promise<void> {
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
    if (membership.toPrimitives().memberRole === 'master') {
      throw new CannotDeactivateMasterError();
    }

    const account = await this.accounts.findById(message.memberUserId());
    if (!account) throw new MemberNotInOrganizationError();

    if (message.shouldBeActive()) account.reactivate();
    else account.suspend();
    await this.accounts.save(account);
  }
}
