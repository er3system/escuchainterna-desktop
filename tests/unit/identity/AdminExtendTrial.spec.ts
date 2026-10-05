import { describe, it, expect, beforeEach } from 'vitest';
import { AdminExtendTrial } from '@/contexts/identity/application/admin-extend-trial/AdminExtendTrial';
import { InvalidTrialExtensionError } from '@/contexts/identity/domain/errors/InvalidTrialExtensionError';
import { SubscriptionNotFoundError } from '@/contexts/identity/domain/errors/SubscriptionNotFoundError';
import { Subscription } from '@/contexts/identity/domain/Subscription';
import type { SubscriptionRepository } from '@/contexts/identity/domain/repositories/SubscriptionRepository';
import type {
  AdminAuditLogRepository,
  AdminAuditEntry,
  AdminAuditRecordInput,
  AdminAuditSearchFilters,
} from '@/contexts/identity/domain/repositories/AdminAuditLogRepository';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Doble en memoria de suscripciones: solo lo que el caso de uso consume
 * (findByUserId/save). recordSimulatedPayment no se usa aquí pero la interfaz
 * lo exige, así que es un no-op.
 */
class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly byUser = new Map<string, Subscription>();

  public async save(subscription: Subscription): Promise<void> {
    this.byUser.set(subscription.ownerUserId(), subscription);
  }

  public async findByUserId(userId: string): Promise<Subscription | null> {
    return this.byUser.get(userId) ?? null;
  }

  public async recordSimulatedPayment(): Promise<void> {
    // no usado por AdminExtendTrial
  }

  public async hasPaymentWithKey(): Promise<boolean> {
    return false;
  }
}

/** Doble en memoria de la bitácora: captura los record() para inspeccionarlos. */
class InMemoryAuditLogRepository implements AdminAuditLogRepository {
  public readonly recorded: AdminAuditRecordInput[] = [];

  public async record(input: AdminAuditRecordInput): Promise<void> {
    this.recorded.push(input);
  }

  public async search(_filters: AdminAuditSearchFilters): Promise<AdminAuditEntry[]> {
    return [];
  }

  public async distinctActions(): Promise<string[]> {
    return [];
  }
}

const ADMIN = 'user-admin';
const TARGET = 'user-target';
const NOW = new Date('2026-06-17T12:00:00.000Z');

describe('AdminExtendTrial', () => {
  let subscriptions: InMemorySubscriptionRepository;
  let audit: InMemoryAuditLogRepository;
  let useCase: AdminExtendTrial;

  beforeEach(() => {
    subscriptions = new InMemorySubscriptionRepository();
    audit = new InMemoryAuditLogRepository();
    useCase = new AdminExtendTrial(subscriptions, audit);
  });

  it('[regresión] extender el trial de una suscripción ACTIVA NO la degrada a trial', async () => {
    // Cuenta activa (pagada/cubierta) con periodo vigente.
    const periodEnd = new Date(NOW.getTime() + 200 * DAY_MS).toISOString();
    await subscriptions.save(
      Subscription.fromPrimitives({
        id: 'sub-1',
        userId: TARGET,
        plan: 'profesional',
        status: 'activa',
        trialEndsAt: NOW.toISOString(),
        currentPeriodEnd: periodEnd,
        canceledAt: null,
        createdAt: NOW.toISOString(),
      }),
    );

    const returned = await useCase.extend(ADMIN, TARGET, 15, NOW);

    const stored = (await subscriptions.findByUserId(TARGET))!.toPrimitives();
    // Conserva status='activa' (no la degrada a 'trial').
    expect(stored.status).toBe('activa');
    // Conserva su currentPeriodEnd vigente (no lo pierde al extender).
    expect(stored.currentPeriodEnd).toBe(periodEnd);
    // Solo extiende trialEndsAt: 15 días desde NOW (trialEndsAt == NOW, base == NOW).
    const expected = new Date(NOW.getTime() + 15 * DAY_MS).toISOString();
    expect(stored.trialEndsAt).toBe(expected);
    expect(returned).toBe(expected);
  });

  it('una suscripción en trial YA VENCIDO se queda en trial contando desde HOY', async () => {
    // Trial venció hace 5 días.
    const expiredTrial = new Date(NOW.getTime() - 5 * DAY_MS).toISOString();
    await subscriptions.save(
      Subscription.fromPrimitives({
        id: 'sub-2',
        userId: TARGET,
        plan: 'profesional',
        status: 'vencida',
        trialEndsAt: expiredTrial,
        currentPeriodEnd: null,
        canceledAt: null,
        createdAt: new Date(NOW.getTime() - 30 * DAY_MS).toISOString(),
      }),
    );

    const returned = await useCase.extend(ADMIN, TARGET, 7, NOW);

    const stored = (await subscriptions.findByUserId(TARGET))!.toPrimitives();
    expect(stored.status).toBe('trial');
    // Como ya venció, los 7 días cuentan desde NOW, no desde el trialEndsAt pasado.
    const expected = new Date(NOW.getTime() + 7 * DAY_MS).toISOString();
    expect(stored.trialEndsAt).toBe(expected);
    expect(returned).toBe(expected);
  });

  it('una suscripción en trial AÚN VIGENTE se queda en trial sumando sobre el trialEndsAt futuro', async () => {
    // Trial todavía vigente: vence en 3 días.
    const futureTrial = new Date(NOW.getTime() + 3 * DAY_MS).toISOString();
    await subscriptions.save(
      Subscription.fromPrimitives({
        id: 'sub-3',
        userId: TARGET,
        plan: 'profesional',
        status: 'trial',
        trialEndsAt: futureTrial,
        currentPeriodEnd: null,
        canceledAt: null,
        createdAt: new Date(NOW.getTime() - 4 * DAY_MS).toISOString(),
      }),
    );

    await useCase.extend(ADMIN, TARGET, 10, NOW);

    const stored = (await subscriptions.findByUserId(TARGET))!.toPrimitives();
    expect(stored.status).toBe('trial');
    // Como aún no vence, los 10 días se suman sobre el trialEndsAt futuro (no desde HOY).
    const expected = new Date(new Date(futureTrial).getTime() + 10 * DAY_MS).toISOString();
    expect(stored.trialEndsAt).toBe(expected);
  });

  describe('days fuera de rango → InvalidTrialExtensionError', () => {
    beforeEach(async () => {
      await subscriptions.save(
        Subscription.fromPrimitives({
          id: 'sub-4',
          userId: TARGET,
          plan: 'profesional',
          status: 'trial',
          trialEndsAt: NOW.toISOString(),
          currentPeriodEnd: null,
          canceledAt: null,
          createdAt: NOW.toISOString(),
        }),
      );
    });

    it('0 días', async () => {
      await expect(useCase.extend(ADMIN, TARGET, 0, NOW)).rejects.toThrow(InvalidTrialExtensionError);
    });

    it('366 días', async () => {
      await expect(useCase.extend(ADMIN, TARGET, 366, NOW)).rejects.toThrow(InvalidTrialExtensionError);
    });

    it('no entero (1.5 días)', async () => {
      await expect(useCase.extend(ADMIN, TARGET, 1.5, NOW)).rejects.toThrow(InvalidTrialExtensionError);
    });

    it('no muta la suscripción ni registra auditoría al rechazar', async () => {
      await expect(useCase.extend(ADMIN, TARGET, 0, NOW)).rejects.toThrow(InvalidTrialExtensionError);
      expect((await subscriptions.findByUserId(TARGET))!.toPrimitives().trialEndsAt).toBe(NOW.toISOString());
      expect(audit.recorded).toHaveLength(0);
    });
  });

  it('usuario sin suscripción → SubscriptionNotFoundError', async () => {
    await expect(useCase.extend(ADMIN, 'desconocido', 7, NOW)).rejects.toThrow(SubscriptionNotFoundError);
    expect(audit.recorded).toHaveLength(0);
  });

  it('registra la auditoría "extender_trial" con actor, target y detalles', async () => {
    await subscriptions.save(
      Subscription.fromPrimitives({
        id: 'sub-5',
        userId: TARGET,
        plan: 'profesional',
        status: 'trial',
        trialEndsAt: NOW.toISOString(),
        currentPeriodEnd: null,
        canceledAt: null,
        createdAt: NOW.toISOString(),
      }),
    );

    const returned = await useCase.extend(ADMIN, TARGET, 14, NOW);

    expect(audit.recorded).toHaveLength(1);
    const entry = audit.recorded[0];
    expect(entry.action).toBe('extender_trial');
    expect(entry.actorUserId).toBe(ADMIN);
    expect(entry.target).toBe(TARGET);
    expect(entry.details).toEqual({ days: 14, trialEndsAt: returned });
  });
});
