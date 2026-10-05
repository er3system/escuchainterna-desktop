import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOrganizationMember } from '@/contexts/identity/application/create-organization-member/CreateOrganizationMember';
import { CreateOrganizationMemberMessage } from '@/contexts/identity/application/create-organization-member/CreateOrganizationMemberMessage';
import { NotOrganizationMasterError } from '@/contexts/identity/application/create-organization-member/NotOrganizationMasterError';
import { EmailAlreadyRegisteredError } from '@/contexts/identity/domain/errors/EmailAlreadyRegisteredError';
import { UserAccount } from '@/contexts/identity/domain/UserAccount';
import { Subscription } from '@/contexts/identity/domain/Subscription';
import { OrganizationMembership } from '@/contexts/identity/domain/OrganizationMembership';
import { MembershipPermissions } from '@/contexts/identity/domain/value-objects/MembershipPermissions';
import type { UserAccountRepository } from '@/contexts/identity/domain/repositories/UserAccountRepository';
import type { SubscriptionRepository } from '@/contexts/identity/domain/repositories/SubscriptionRepository';
import type { OrganizationMembershipRepository } from '@/contexts/identity/domain/repositories/OrganizationMembershipRepository';
import type { ProfileProvisioner, InitialProfileInput } from '@/contexts/identity/domain/ProfileProvisioner';
import type { PasswordHasher } from '@/contexts/identity/domain/PasswordHasher';

/**
 * Alta de un miembro de la organización desde el hub del maestro.
 * Dobles en memoria; sin tocar SQLite ni la infraestructura real.
 * Cubre el guard assertActorIsMaster (incluido el aislamiento cross-tenant),
 * el correo duplicado y el camino feliz (rol, suscripción activa, membresía
 * con permisos y contraseña temporal de 12 caracteres).
 */

class InMemoryUserAccounts implements UserAccountRepository {
  public readonly saved: UserAccount[] = [];
  private readonly byEmail = new Map<string, UserAccount>();
  private readonly byId = new Map<string, UserAccount>();

  public async save(account: UserAccount): Promise<void> {
    this.saved.push(account);
    this.byEmail.set(account.accountEmail(), account);
    this.byId.set(account.accountId(), account);
  }

  public async findByEmail(email: string): Promise<UserAccount | null> {
    return this.byEmail.get(email.toLowerCase().trim()) ?? null;
  }

  public async findById(id: string): Promise<UserAccount | null> {
    return this.byId.get(id) ?? null;
  }

  public readonly verified: string[] = [];

  public async markEmailVerified(userId: string): Promise<void> {
    this.verified.push(userId);
  }

  public async recordTermsAcceptance(): Promise<void> {
    /* no aplica a estos tests */
  }
}

class InMemorySubscriptions implements SubscriptionRepository {
  public readonly saved: Subscription[] = [];
  private readonly byUser = new Map<string, Subscription>();

  public async save(subscription: Subscription): Promise<void> {
    this.saved.push(subscription);
    this.byUser.set(subscription.ownerUserId(), subscription);
  }

  public async findByUserId(userId: string): Promise<Subscription | null> {
    return this.byUser.get(userId) ?? null;
  }

  public async recordSimulatedPayment(): Promise<void> {
    // No-op en memoria; el alta cubierta por la org no registra pagos.
  }

  public async hasPaymentWithKey(): Promise<boolean> {
    return false;
  }
}

class InMemoryMemberships implements OrganizationMembershipRepository {
  public readonly saved: OrganizationMembership[] = [];
  private readonly byUser = new Map<string, OrganizationMembership>();

  public seed(membership: OrganizationMembership): void {
    this.byUser.set(membership.memberUserId(), membership);
  }

  public async save(membership: OrganizationMembership): Promise<void> {
    this.saved.push(membership);
    this.byUser.set(membership.memberUserId(), membership);
  }

  public async findByUserId(userId: string): Promise<OrganizationMembership | null> {
    return this.byUser.get(userId) ?? null;
  }

  public async listByOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    return [...this.byUser.values()].filter((m) => m.membershipOrganizationId() === organizationId);
  }
}

class SpyProfileProvisioner implements ProfileProvisioner {
  public readonly created: InitialProfileInput[] = [];

  public async createInitialProfile(input: InitialProfileInput): Promise<void> {
    this.created.push(input);
  }

  public async updateFullName(): Promise<void> {
    // No-op: no se usa en el alta.
  }
}

class FakeHasher implements PasswordHasher {
  public hash(plain: string): string {
    return `hashed:${plain}`;
  }

  public verify(plain: string, storedHash: string): boolean {
    return storedHash === `hashed:${plain}`;
  }
}

const ORG_A = 'org-a';
const ORG_B = 'org-b';
const MASTER_A = 'master-a';
const MASTER_B = 'master-b';
const PSYCHOLOGIST_A = 'psychologist-a';

function masterPermissions(): MembershipPermissions {
  return MembershipPermissions.defaults();
}

function newMessage(
  overrides: Partial<{
    organizationId: string;
    actorUserId: string;
    fullName: string;
    email: string;
    memberRole: 'psychologist' | 'professor';
    permissions: ReturnType<MembershipPermissions['toPrimitives']>;
  }> = {},
): CreateOrganizationMemberMessage {
  return new CreateOrganizationMemberMessage({
    organizationId: overrides.organizationId ?? ORG_A,
    actorUserId: overrides.actorUserId ?? MASTER_A,
    fullName: overrides.fullName ?? 'Nueva Miembro',
    email: overrides.email ?? 'nueva@org.test',
    memberRole: overrides.memberRole ?? 'psychologist',
    permissions:
      overrides.permissions ??
      MembershipPermissions.fromPrimitives({
        canCharge: true,
        retentionPercent: 15,
        forceAppPayments: true,
        paymentsDisabled: false,
        canSupervisePatients: true,
        canConfigurePayments: false,
      }).toPrimitives(),
  });
}

describe('CreateOrganizationMember', () => {
  let accounts: InMemoryUserAccounts;
  let subscriptions: InMemorySubscriptions;
  let memberships: InMemoryMemberships;
  let profiles: SpyProfileProvisioner;
  let hasher: FakeHasher;
  let useCase: CreateOrganizationMember;

  beforeEach(() => {
    accounts = new InMemoryUserAccounts();
    subscriptions = new InMemorySubscriptions();
    memberships = new InMemoryMemberships();
    profiles = new SpyProfileProvisioner();
    hasher = new FakeHasher();
    useCase = new CreateOrganizationMember(accounts, subscriptions, memberships, profiles, hasher);

    // Maestro de la organización A.
    memberships.seed(
      OrganizationMembership.create('m-master-a', ORG_A, MASTER_A, 'master', masterPermissions()),
    );
    // Maestro de OTRA organización (B): debe quedar aislado de A.
    memberships.seed(
      OrganizationMembership.create('m-master-b', ORG_B, MASTER_B, 'master', masterPermissions()),
    );
    // Miembro NO-master de la organización A.
    memberships.seed(
      OrganizationMembership.create(
        'm-psy-a',
        ORG_A,
        PSYCHOLOGIST_A,
        'psychologist',
        masterPermissions(),
      ),
    );
  });

  describe('guard assertActorIsMaster', () => {
    it('rechaza a un miembro NO-master de la organización', async () => {
      await expect(useCase.create(newMessage({ actorUserId: PSYCHOLOGIST_A }))).rejects.toThrow(
        NotOrganizationMasterError,
      );
      expect(accounts.saved).toHaveLength(0);
      expect(subscriptions.saved).toHaveLength(0);
      expect(memberships.saved).toHaveLength(0);
    });

    it('rechaza al maestro de OTRA organización (aislamiento cross-tenant)', async () => {
      // MASTER_B es master, pero de ORG_B; no puede crear miembros en ORG_A.
      await expect(
        useCase.create(newMessage({ actorUserId: MASTER_B, organizationId: ORG_A })),
      ).rejects.toThrow(NotOrganizationMasterError);
      expect(accounts.saved).toHaveLength(0);
    });

    it('rechaza a un actor sin membresía', async () => {
      await expect(
        useCase.create(newMessage({ actorUserId: 'fantasma-sin-membresia' })),
      ).rejects.toThrow(NotOrganizationMasterError);
      expect(accounts.saved).toHaveLength(0);
    });
  });

  it('rechaza un correo ya registrado con EmailAlreadyRegisteredError', async () => {
    await accounts.save(
      UserAccount.provision(
        'ya-existe',
        'nueva@org.test',
        hasher.hash('algo'),
        'psychologist',
        null,
      ),
    );

    await expect(useCase.create(newMessage({ email: 'Nueva@Org.test' }))).rejects.toThrow(
      EmailAlreadyRegisteredError,
    );
    // No se crea una segunda cuenta ni efectos colaterales.
    expect(accounts.saved).toHaveLength(1);
    expect(subscriptions.saved).toHaveLength(0);
    expect(memberships.saved).toHaveLength(0);
  });

  describe('alta feliz', () => {
    it('crea cuenta, perfil, suscripción activa y membresía con permisos; devuelve contraseña temporal de 12 chars', async () => {
      const permissions = MembershipPermissions.fromPrimitives({
        canCharge: true,
        retentionPercent: 20,
        forceAppPayments: true,
        paymentsDisabled: false,
        canSupervisePatients: true,
        canConfigurePayments: false,
      });

      const result = await useCase.create(
        newMessage({
          fullName: 'Camila Psicóloga',
          email: 'camila@org.test',
          memberRole: 'psychologist',
          permissions: permissions.toPrimitives(),
        }),
      );

      // Contraseña temporal de 12 caracteres, devuelta al maestro.
      expect(result.temporaryPassword).toHaveLength(12);

      // Cuenta creada: rol psychologist, creada por el maestro, contraseña hasheada.
      expect(accounts.saved).toHaveLength(1);
      const account = accounts.saved[0];
      expect(account.accountId()).toBe(result.userId);
      expect(account.accountEmail()).toBe('camila@org.test');
      expect(account.accountRole()).toBe('psychologist');
      expect(account.isSuspended()).toBe(false);
      expect(account.toPrimitives().createdBy).toBe(MASTER_A);
      expect(account.storedPasswordHash()).toBe(hasher.hash(result.temporaryPassword));

      // Perfil inicial provisionado con el nombre del miembro.
      expect(profiles.created).toHaveLength(1);
      expect(profiles.created[0].userId).toBe(result.userId);
      expect(profiles.created[0].fullName).toBe('Camila Psicóloga');

      // Suscripción ACTIVA cubierta por la org (sin paywall).
      expect(subscriptions.saved).toHaveLength(1);
      const subscription = subscriptions.saved[0];
      expect(subscription.ownerUserId()).toBe(result.userId);
      expect(subscription.currentStatus()).toBe('activa');
      expect(subscription.isExpired()).toBe(false);

      // Membresía con la organización del maestro y los permisos dados.
      expect(memberships.saved).toHaveLength(1);
      const membership = memberships.saved[0];
      expect(membership.membershipOrganizationId()).toBe(ORG_A);
      expect(membership.memberUserId()).toBe(result.userId);
      expect(membership.toPrimitives().memberRole).toBe('psychologist');
      expect(membership.membershipPermissions().toPrimitives()).toEqual(permissions.toPrimitives());
    });

    it("memberRole='professor' crea una cuenta con rol professor", async () => {
      const result = await useCase.create(
        newMessage({ email: 'profe@org.test', memberRole: 'professor' }),
      );

      expect(accounts.saved[0].accountRole()).toBe('professor');
      expect(memberships.saved[0].toPrimitives().memberRole).toBe('professor');
      expect(result.temporaryPassword).toHaveLength(12);
    });

    it("memberRole='psychologist' crea una cuenta con rol psychologist", async () => {
      await useCase.create(newMessage({ email: 'psico@org.test', memberRole: 'psychologist' }));

      expect(accounts.saved[0].accountRole()).toBe('psychologist');
      expect(memberships.saved[0].toPrimitives().memberRole).toBe('psychologist');
    });
  });
});
