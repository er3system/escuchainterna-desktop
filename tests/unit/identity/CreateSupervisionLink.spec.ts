import { describe, it, expect, beforeEach } from 'vitest';
import { CreateSupervisionLink } from '@/contexts/identity/application/create-supervision-link/CreateSupervisionLink';
import { CreateSupervisionLinkMessage } from '@/contexts/identity/application/create-supervision-link/CreateSupervisionLinkMessage';
import { SupervisorNotAllowedError } from '@/contexts/identity/application/create-supervision-link/SupervisorNotAllowedError';
import { NotOrganizationMasterError } from '@/contexts/identity/application/create-organization-member/NotOrganizationMasterError';
import { MemberNotInOrganizationError } from '@/contexts/identity/application/update-member-permissions/MemberNotInOrganizationError';
import {
  OrganizationMembership,
  type OrganizationMemberRole,
} from '@/contexts/identity/domain/OrganizationMembership';
import { MembershipPermissions } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import { SupervisionLink } from '@/contexts/identity/domain/SupervisionLink';
import type { OrganizationMembershipRepository } from '@/contexts/identity/domain/repositories/OrganizationMembershipRepository';
import type { SupervisionLinkRepository } from '@/contexts/identity/domain/repositories/SupervisionLinkRepository';

/** Doble en memoria de membresías: solo lo que el caso de uso consume. */
class InMemoryMembershipRepository implements OrganizationMembershipRepository {
  private readonly byUser = new Map<string, OrganizationMembership>();

  public async save(membership: OrganizationMembership): Promise<void> {
    this.byUser.set(membership.memberUserId(), membership);
  }

  public async findByUserId(userId: string): Promise<OrganizationMembership | null> {
    return this.byUser.get(userId) ?? null;
  }

  public async listByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    return [...this.byUser.values()].filter(
      (m) => m.membershipOrganizationId() === organizationId,
    );
  }
}

/**
 * Doble en memoria de vínculos que reproduce el upsert del repositorio real
 * (SqliteSupervisionLinkRepository): la clave única es
 * (organizationId, supervisorUserId, supervisedUserId); en conflicto conserva
 * el id existente y solo refresca el alcance (re-activa).
 */
class InMemorySupervisionLinkRepository implements SupervisionLinkRepository {
  private readonly byKey = new Map<string, SupervisionLink>();

  private static keyOf(link: SupervisionLink): string {
    const p = link.toPrimitives();
    return `${p.organizationId}|${p.supervisorUserId}|${p.supervisedUserId}`;
  }

  public async save(link: SupervisionLink): Promise<void> {
    const key = InMemorySupervisionLinkRepository.keyOf(link);
    const existing = this.byKey.get(key);
    if (existing) {
      // Conserva el id original, refresca el alcance (igual que ON CONFLICT DO UPDATE).
      const incoming = link.toPrimitives();
      this.byKey.set(
        key,
        SupervisionLink.fromPrimitives({
          ...existing.toPrimitives(),
          scope: incoming.scope,
        }),
      );
      return;
    }
    this.byKey.set(key, link);
  }

  public async listBySupervisor(supervisorUserId: string): Promise<SupervisionLink[]> {
    return [...this.byKey.values()].filter(
      (l) => l.toPrimitives().supervisorUserId === supervisorUserId,
    );
  }

  public async supervisesAnyone(supervisorUserId: string): Promise<boolean> {
    return (await this.listBySupervisor(supervisorUserId)).length > 0;
  }

  /** Helper de test: todos los vínculos almacenados. */
  public all(): SupervisionLink[] {
    return [...this.byKey.values()];
  }
}

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const MASTER = 'user-master';
const SUPERVISOR = 'user-supervisor';
const SUPERVISED = 'user-supervised';

function membership(
  userId: string,
  role: OrganizationMemberRole,
  organizationId = ORG,
  permissions: MembershipPermissions = MembershipPermissions.defaults(),
): OrganizationMembership {
  return OrganizationMembership.create(
    `mem-${userId}`,
    organizationId,
    userId,
    role,
    permissions,
  );
}

function withSupervise(value: boolean): MembershipPermissions {
  return MembershipPermissions.fromPrimitives({
    canCharge: true,
    retentionPercent: 0,
    forceAppPayments: false,
    paymentsDisabled: false,
    canSupervisePatients: value,
    canConfigurePayments: true,
  });
}

describe('CreateSupervisionLink', () => {
  let memberships: InMemoryMembershipRepository;
  let links: InMemorySupervisionLinkRepository;
  let useCase: CreateSupervisionLink;

  beforeEach(() => {
    memberships = new InMemoryMembershipRepository();
    links = new InMemorySupervisionLinkRepository();
    useCase = new CreateSupervisionLink(memberships, links);
  });

  function message(scope: Partial<SupervisionLink['allowsNotes']> | object = {}) {
    return new CreateSupervisionLinkMessage({
      organizationId: ORG,
      actorUserId: MASTER,
      supervisorUserId: SUPERVISOR,
      supervisedUserId: SUPERVISED,
      scope: scope as never,
    });
  }

  it('si el actor no es maestro de la organización, lanza NotOrganizationMasterError', async () => {
    // El actor existe pero con rol psychologist, no master.
    await memberships.save(membership(MASTER, 'psychologist'));
    await memberships.save(membership(SUPERVISOR, 'professor'));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    await expect(useCase.create(message())).rejects.toThrow(NotOrganizationMasterError);
    expect(links.all()).toHaveLength(0);
  });

  it('actor master pero el supervisor no es de la organización → MemberNotInOrganizationError', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'professor', OTHER_ORG));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    await expect(useCase.create(message())).rejects.toThrow(MemberNotInOrganizationError);
    expect(links.all()).toHaveLength(0);
  });

  it('actor master pero el supervisado no es de la organización → MemberNotInOrganizationError', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'professor'));
    await memberships.save(membership(SUPERVISED, 'psychologist', OTHER_ORG));

    await expect(useCase.create(message())).rejects.toThrow(MemberNotInOrganizationError);
    expect(links.all()).toHaveLength(0);
  });

  it('supervisor sin rol professor y sin can_supervise_patients → SupervisorNotAllowedError', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'psychologist', ORG, withSupervise(false)));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    await expect(useCase.create(message())).rejects.toThrow(SupervisorNotAllowedError);
    expect(links.all()).toHaveLength(0);
  });

  it('supervisor con rol professor (sin permiso explícito) puede supervisar', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'professor', ORG, withSupervise(false)));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    const id = await useCase.create(message());

    expect(typeof id).toBe('string');
    expect(id).not.toHaveLength(0);
    expect(links.all()).toHaveLength(1);
    expect(links.all()[0].toPrimitives().supervisorUserId).toBe(SUPERVISOR);
    expect(links.all()[0].toPrimitives().supervisedUserId).toBe(SUPERVISED);
  });

  it('supervisor psychologist con can_supervise_patients=true puede supervisar', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'psychologist', ORG, withSupervise(true)));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    const id = await useCase.create(message());

    expect(id).toBeTruthy();
    expect(links.all()).toHaveLength(1);
  });

  it('crea el vínculo con el alcance dado y devuelve su id', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'professor'));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    const id = await useCase.create(message({ notas: true, historias: false, pagos: true }));

    const stored = links.all();
    expect(stored).toHaveLength(1);
    expect(stored[0].toPrimitives().id).toBe(id);
    expect(stored[0].toPrimitives().organizationId).toBe(ORG);
    expect(stored[0].toPrimitives().scope).toEqual({
      notas: true,
      historias: false,
      pagos: true,
    });
  });

  it('un segundo create del MISMO par hace upsert (re-activa, no duplica)', async () => {
    await memberships.save(membership(MASTER, 'master'));
    await memberships.save(membership(SUPERVISOR, 'professor'));
    await memberships.save(membership(SUPERVISED, 'psychologist'));

    const firstId = await useCase.create(message({ notas: true, historias: true, pagos: false }));
    await useCase.create(message({ notas: false, historias: false, pagos: true }));

    const stored = links.all();
    // Sigue habiendo un único vínculo para el par (upsert, no duplicado).
    expect(stored).toHaveLength(1);
    // Conserva el id original del primer vínculo.
    expect(stored[0].toPrimitives().id).toBe(firstId);
    // Y refresca el alcance al del segundo create.
    expect(stored[0].toPrimitives().scope).toEqual({
      notas: false,
      historias: false,
      pagos: true,
    });
  });
});
