import { Organization } from '../../domain/Organization';
import type { OrganizationRepository } from '../../domain/repositories/OrganizationRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import { NotOrganizationMasterError } from '../create-organization-member/NotOrganizationMasterError';
import { OrganizationNotFoundError } from './OrganizationNotFoundError';
import { OrganizationSlugTakenError } from './OrganizationSlugTakenError';
import { UpdateOrganizationBrandingMessage } from './UpdateOrganizationBrandingMessage';

/**
 * El maestro actualiza el branding de SU organización: slug (vista previa del
 * subdominio <slug>.escuchainterna.com) y logo (data/uploads/orgs/<orgId>/).
 */
export class UpdateOrganizationBranding {
  public constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: OrganizationMembershipRepository,
  ) {}

  public async update(message: UpdateOrganizationBrandingMessage): Promise<void> {
    const organization = await this.organizations.findById(message.organizationId());
    if (!organization) throw new OrganizationNotFoundError();

    await this.assertActorIsMaster(organization, message.actorUserId());

    const primitives = organization.toPrimitives();
    const nextSlug = message.slug() ?? primitives.slug;
    if (nextSlug !== primitives.slug) {
      const existing = await this.organizations.findBySlug(nextSlug);
      if (existing && existing.organizationId() !== primitives.id) {
        throw new OrganizationSlugTakenError(nextSlug);
      }
    }

    const nextLogoPath = message.logoPath() === undefined ? primitives.logoPath : message.logoPath();

    await this.organizations.save(
      Organization.fromPrimitives({
        ...primitives,
        slug: nextSlug,
        logoPath: nextLogoPath ?? null,
        freeService: message.freeService() ?? primitives.freeService,
      }),
    );
  }

  private async assertActorIsMaster(organization: Organization, actorUserId: string): Promise<void> {
    const primitives = organization.toPrimitives();
    if (primitives.masterUserId === actorUserId) return;
    const membership = await this.memberships.findByUserId(actorUserId);
    if (
      membership &&
      membership.membershipOrganizationId() === primitives.id &&
      membership.toPrimitives().memberRole === 'master'
    ) {
      return;
    }
    throw new NotOrganizationMasterError();
  }
}
