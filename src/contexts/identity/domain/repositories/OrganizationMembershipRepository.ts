import { OrganizationMembership } from '../OrganizationMembership';

export interface OrganizationMembershipRepository {
  save(membership: OrganizationMembership): Promise<void>;
  findByUserId(userId: string): Promise<OrganizationMembership | null>;
  listByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
}
