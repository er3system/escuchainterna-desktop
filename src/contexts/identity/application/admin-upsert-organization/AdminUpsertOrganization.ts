import { randomUUID } from 'node:crypto';
import { Organization, type OrganizationPrimitives } from '../../domain/Organization';
import { OrganizationMembership } from '../../domain/OrganizationMembership';
import { MembershipPermissions } from '../../domain/value-objects/MembershipPermissions';
import { OrganizationNotFoundError } from '../../domain/errors/OrganizationNotFoundError';
import { OrganizationSlugTakenError } from '../../domain/errors/OrganizationSlugTakenError';
import { UserNotFoundError } from '../../domain/errors/UserNotFoundError';
import type { OrganizationRepository } from '../../domain/repositories/OrganizationRepository';
import type { OrganizationMembershipRepository } from '../../domain/repositories/OrganizationMembershipRepository';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';
import type { AdminAuditLogRepository } from '../../domain/repositories/AdminAuditLogRepository';
import type { AdminUpsertOrganizationMessage } from './AdminUpsertOrganizationMessage';

/**
 * Crea o edita una organización desde /admin: nombre, slug único, tipo,
 * maestro asignado (le garantiza membresía 'master') y políticas por defecto.
 * Registra auditoría.
 */
export class AdminUpsertOrganization {
  public constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: OrganizationMembershipRepository,
    private readonly accounts: UserAccountRepository,
    private readonly audit: AdminAuditLogRepository,
  ) {}

  public async upsert(message: AdminUpsertOrganizationMessage): Promise<string> {
    const existingBySlug = await this.organizations.findBySlug(message.slug());
    if (existingBySlug && existingBySlug.organizationId() !== message.organizationId()) {
      throw new OrganizationSlugTakenError(message.slug());
    }
    if (message.masterUserId() && !(await this.accounts.findById(message.masterUserId()!))) {
      throw new UserNotFoundError(message.masterUserId()!);
    }

    let primitives: OrganizationPrimitives;
    const isEdit = message.organizationId() !== null;
    if (isEdit) {
      const current = await this.organizations.findById(message.organizationId()!);
      if (!current) throw new OrganizationNotFoundError(message.organizationId()!);
      const currentPrimitives = current.toPrimitives();
      primitives = {
        ...currentPrimitives,
        name: message.name(),
        slug: message.slug(),
        kind: message.kind(),
        masterUserId: message.masterUserId(),
        defaultMemberPoliciesJson:
          message.defaultMemberPolicies()?.toJson() ?? currentPrimitives.defaultMemberPoliciesJson,
        freeService: message.freeService() ?? currentPrimitives.freeService,
      };
    } else {
      primitives = {
        id: randomUUID(),
        name: message.name(),
        slug: message.slug(),
        kind: message.kind(),
        logoPath: null,
        masterUserId: message.masterUserId(),
        defaultMemberPoliciesJson: message.defaultMemberPolicies()?.toJson() ?? '{}',
        freeService: message.freeService() ?? false,
        createdAt: new Date().toISOString(),
      };
    }
    await this.organizations.save(Organization.fromPrimitives(primitives));

    // El maestro asignado debe pertenecer a su organización con rol 'master'.
    if (primitives.masterUserId) {
      const membership = await this.memberships.findByUserId(primitives.masterUserId);
      if (!membership || membership.membershipOrganizationId() !== primitives.id) {
        await this.memberships.save(
          OrganizationMembership.create(
            randomUUID(),
            primitives.id,
            primitives.masterUserId,
            'master',
            MembershipPermissions.defaults(),
          ),
        );
      }
    }

    await this.audit.record({
      actorUserId: message.actorUserId(),
      action: isEdit ? 'editar_organizacion' : 'crear_organizacion',
      target: message.slug(),
      details: { organizationId: primitives.id, name: message.name(), kind: message.kind() },
    });
    return primitives.id;
  }
}
