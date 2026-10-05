import { describe, it, expect } from 'vitest';
import { Subscription } from '@/contexts/identity/domain/Subscription';
import { ActivateSubscription } from '@/contexts/identity/application/activate-subscription/ActivateSubscription';
import { CancelSubscription } from '@/contexts/identity/application/cancel-subscription/CancelSubscription';
import { ResumeSubscription } from '@/contexts/identity/application/resume-subscription/ResumeSubscription';
import type { SubscriptionRepository } from '@/contexts/identity/domain/repositories/SubscriptionRepository';

const DAY_MS = 24 * 60 * 60 * 1000;
const USER = 'u1';

interface PaymentRecord {
  subscriptionId: string;
  amount: number;
  currency: string;
  key: string | null;
}

/** Doble en memoria que espeja el índice único de idempotencia de subscription_payments. */
class InMemorySubscriptions implements SubscriptionRepository {
  private readonly byUser = new Map<string, Subscription>();
  public readonly payments: PaymentRecord[] = [];

  public seed(sub: Subscription): void {
    this.byUser.set(sub.ownerUserId(), sub);
  }
  public async save(sub: Subscription): Promise<void> {
    this.byUser.set(sub.ownerUserId(), sub);
  }
  public async findByUserId(userId: string): Promise<Subscription | null> {
    return this.byUser.get(userId) ?? null;
  }
  public async recordSimulatedPayment(
    subscriptionId: string,
    amount: number,
    currency: string,
    key: string | null = null,
  ): Promise<void> {
    if (key !== null && this.payments.some((p) => p.key === key)) {
      throw new Error('UNIQUE constraint failed: idempotency_key');
    }
    this.payments.push({ subscriptionId, amount, currency, key });
  }
  public async hasPaymentWithKey(key: string): Promise<boolean> {
    return this.payments.some((p) => p.key === key);
  }
}

function activeSub(periodEndMs: number): Subscription {
  return Subscription.fromPrimitives({
    id: 's1',
    userId: USER,
    plan: 'profesional',
    status: 'activa',
    trialEndsAt: new Date(0).toISOString(),
    currentPeriodEnd: new Date(periodEndMs).toISOString(),
    canceledAt: null,
    createdAt: new Date(0).toISOString(),
  });
}

describe('Subscription · cancelar al fin de periodo', () => {
  it('una activa NO cancelada no caduca aunque el periodo haya pasado (sin auto-renovación aún)', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const sub = activeSub(now.getTime() - 10 * DAY_MS); // periodo ya pasó
    expect(sub.isExpired(now)).toBe(false);
  });

  it('cancelar conserva el acceso hasta el fin de periodo y luego caduca; el status no cambia', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const periodEnd = now.getTime() + 10 * DAY_MS;
    const sub = activeSub(periodEnd);

    sub.requestCancellation(now);
    expect(sub.isCanceled()).toBe(true);
    expect(sub.currentStatus()).toBe('activa');
    // Dentro del periodo ya pagado: conserva acceso.
    expect(sub.isExpired(now)).toBe(false);
    // Pasado el fin de periodo: caduca (no se renueva).
    expect(sub.isExpired(new Date(periodEnd + DAY_MS))).toBe(true);
  });

  it('reanudar limpia la cancelación (vuelve a no caducar por periodo)', () => {
    const now = new Date('2026-06-01T00:00:00.000Z');
    const periodEnd = now.getTime() + 10 * DAY_MS;
    const sub = activeSub(periodEnd);
    sub.requestCancellation(now);
    sub.resume();
    expect(sub.isCanceled()).toBe(false);
    expect(sub.isExpired(new Date(periodEnd + DAY_MS))).toBe(false);
  });

  it('pagar de nuevo (activate) levanta cualquier cancelación previa', () => {
    const now = new Date();
    const sub = activeSub(now.getTime() + DAY_MS);
    sub.requestCancellation(now);
    sub.activate(now, 30);
    expect(sub.isCanceled()).toBe(false);
  });

  it('CancelSubscription y ResumeSubscription persisten el cambio', async () => {
    const repo = new InMemorySubscriptions();
    repo.seed(activeSub(Date.now() + 10 * DAY_MS));

    await new CancelSubscription(repo).cancel(USER);
    expect((await repo.findByUserId(USER))!.isCanceled()).toBe(true);

    await new ResumeSubscription(repo).resume(USER);
    expect((await repo.findByUserId(USER))!.isCanceled()).toBe(false);
  });
});

describe('ActivateSubscription · idempotencia del cobro', () => {
  function trialSub(): Subscription {
    return Subscription.startTrial('s1', USER, new Date());
  }

  it('SIN clave: dos activaciones registran DOS pagos (comportamiento previo intacto)', async () => {
    const repo = new InMemorySubscriptions();
    repo.seed(trialSub());
    const useCase = new ActivateSubscription(repo);
    await useCase.activate(USER, { amount: 100, currency: 'COP' });
    await useCase.activate(USER, { amount: 100, currency: 'COP' });
    expect(repo.payments).toHaveLength(2);
  });

  it('con la MISMA clave: el reintento no cobra ni extiende el periodo dos veces', async () => {
    const repo = new InMemorySubscriptions();
    repo.seed(trialSub());
    const useCase = new ActivateSubscription(repo);

    const first = await useCase.activate(USER, { amount: 100, currency: 'COP', idempotencyKey: 'k1' });
    const periodEnd1 = (await repo.findByUserId(USER))!.toPrimitives().currentPeriodEnd;
    const second = await useCase.activate(USER, { amount: 100, currency: 'COP', idempotencyKey: 'k1' });
    const periodEnd2 = (await repo.findByUserId(USER))!.toPrimitives().currentPeriodEnd;

    expect(first.alreadyApplied).toBeFalsy();
    expect(second.alreadyApplied).toBe(true);
    expect(repo.payments).toHaveLength(1); // un solo cobro
    expect(periodEnd2).toBe(periodEnd1); // el periodo no se re-extiende
  });

  it('claves DISTINTAS (renovaciones intencionales) cobran cada una', async () => {
    const repo = new InMemorySubscriptions();
    repo.seed(trialSub());
    const useCase = new ActivateSubscription(repo);
    await useCase.activate(USER, { amount: 100, currency: 'COP', idempotencyKey: 'k1' });
    await useCase.activate(USER, { amount: 100, currency: 'COP', idempotencyKey: 'k2' });
    expect(repo.payments).toHaveLength(2);
  });
});
