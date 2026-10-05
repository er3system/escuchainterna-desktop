import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { UpdateMemberPermissions } from '@/contexts/identity/application/update-member-permissions/UpdateMemberPermissions';
import { UpdateMemberPermissionsMessage } from '@/contexts/identity/application/update-member-permissions/UpdateMemberPermissionsMessage';
import { MemberNotInOrganizationError } from '@/contexts/identity/application/update-member-permissions/MemberNotInOrganizationError';
import { NotOrganizationMasterError } from '@/contexts/identity/application/create-organization-member/NotOrganizationMasterError';
import { OrganizationMembership } from '@/contexts/identity/domain/OrganizationMembership';
import type { OrganizationMemberRole } from '@/contexts/identity/domain/OrganizationMembership';
import { MembershipPermissions } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import type { MembershipPermissionsPrimitives } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import type { OrganizationMembershipRepository } from '@/contexts/identity/domain/repositories/OrganizationMembershipRepository';

/**
 * Doble en memoria del repositorio de membresías: indexa por userId
 * (que es como el caso de uso resuelve al actor y al miembro objetivo).
 */
class InMemoryMembershipRepository implements OrganizationMembershipRepository {
  private readonly byUserId = new Map<string, OrganizationMembership>();

  public seed(membership: OrganizationMembership): void {
    this.byUserId.set(membership.memberUserId(), membership);
  }

  public async save(membership: OrganizationMembership): Promise<void> {
    this.byUserId.set(membership.memberUserId(), membership);
  }

  public async findByUserId(userId: string): Promise<OrganizationMembership | null> {
    return this.byUserId.get(userId) ?? null;
  }

  public async listByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    return [...this.byUserId.values()].filter(
      (membership) => membership.membershipOrganizationId() === organizationId,
    );
  }
}

function buildMembership(
  organizationId: string,
  userId: string,
  role: OrganizationMemberRole,
): OrganizationMembership {
  return OrganizationMembership.create(
    randomUUID(),
    organizationId,
    userId,
    role,
    MembershipPermissions.defaults(),
  );
}

describe('UpdateMemberPermissions', () => {
  let repository: InMemoryMembershipRepository;
  let useCase: UpdateMemberPermissions;

  const organizationId = 'org-1';
  const otherOrganizationId = 'org-2';
  const masterUserId = 'user-master';
  const memberUserId = 'user-member';

  /** Permisos nuevos, distintos de los defaults, para poder verificar la persistencia. */
  const newPermissions: MembershipPermissionsPrimitives = {
    canCharge: false,
    retentionPercent: 30,
    forceAppPayments: true,
    paymentsDisabled: true,
    canSupervisePatients: true,
    canConfigurePayments: false,
  };

  function messageFor(input: {
    organizationId?: string;
    actorUserId?: string;
    memberUserId?: string;
    permissions?: MembershipPermissionsPrimitives;
  }): UpdateMemberPermissionsMessage {
    return new UpdateMemberPermissionsMessage({
      organizationId: input.organizationId ?? organizationId,
      actorUserId: input.actorUserId ?? masterUserId,
      memberUserId: input.memberUserId ?? memberUserId,
      permissions: input.permissions ?? newPermissions,
    });
  }

  beforeEach(() => {
    repository = new InMemoryMembershipRepository();
    useCase = new UpdateMemberPermissions(repository);
  });

  it('rechaza a un actor que no es maestro de la organización', async () => {
    // El actor pertenece a la org pero con rol psychologist (no master).
    repository.seed(buildMembership(organizationId, masterUserId, 'psychologist'));
    repository.seed(buildMembership(organizationId, memberUserId, 'psychologist'));

    await expect(useCase.update(messageFor({ actorUserId: masterUserId }))).rejects.toThrow(
      NotOrganizationMasterError,
    );
  });

  it('rechaza a un maestro de OTRA organización', async () => {
    // Actor es master, pero de otherOrganizationId, no de la org del mensaje.
    repository.seed(buildMembership(otherOrganizationId, masterUserId, 'master'));
    repository.seed(buildMembership(organizationId, memberUserId, 'psychologist'));

    await expect(
      useCase.update(messageFor({ organizationId, actorUserId: masterUserId })),
    ).rejects.toThrow(NotOrganizationMasterError);
  });

  it('rechaza cuando el miembro objetivo no pertenece a la organización', async () => {
    repository.seed(buildMembership(organizationId, masterUserId, 'master'));
    // El miembro existe, pero en otra organización.
    repository.seed(buildMembership(otherOrganizationId, memberUserId, 'psychologist'));

    await expect(useCase.update(messageFor({}))).rejects.toThrow(MemberNotInOrganizationError);
  });

  it('rechaza cuando el miembro objetivo no existe', async () => {
    repository.seed(buildMembership(organizationId, masterUserId, 'master'));
    // No se siembra ninguna membresía para memberUserId.

    await expect(useCase.update(messageFor({ memberUserId: 'fantasma' }))).rejects.toThrow(
      MemberNotInOrganizationError,
    );
  });

  it('caso feliz: persiste los nuevos permisos en la membresía', async () => {
    repository.seed(buildMembership(organizationId, masterUserId, 'master'));
    repository.seed(buildMembership(organizationId, memberUserId, 'psychologist'));

    await useCase.update(messageFor({ permissions: newPermissions }));

    // Releemos del repo para comprobar que el cambio quedó persistido.
    const updated = await repository.findByUserId(memberUserId);
    expect(updated).not.toBeNull();
    expect(updated!.membershipPermissions().toPrimitives()).toEqual(newPermissions);
  });
});
