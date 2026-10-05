import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Subscription, type SubscriptionStatus } from '../../domain/Subscription';
import type { SubscriptionRepository } from '../../domain/repositories/SubscriptionRepository';

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  trial_ends_at: string;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
}

export class SqliteSubscriptionRepository implements SubscriptionRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(subscription: Subscription): Promise<void> {
    const primitives = subscription.toPrimitives();
    await this.db.execute(
      `INSERT INTO subscriptions
           (id, user_id, plan, status, trial_ends_at, current_period_end, canceled_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           plan = excluded.plan,
           status = excluded.status,
           trial_ends_at = excluded.trial_ends_at,
           current_period_end = excluded.current_period_end,
           canceled_at = excluded.canceled_at`,
      [
        primitives.id,
        primitives.userId,
        primitives.plan,
        primitives.status,
        primitives.trialEndsAt,
        primitives.currentPeriodEnd,
        primitives.canceledAt,
        primitives.createdAt,
      ],
    );
  }

  public async findByUserId(userId: string): Promise<Subscription | null> {
    const row = await this.db.queryRow<SubscriptionRow>(
      'SELECT * FROM subscriptions WHERE user_id = ?',
      [userId],
    );
    if (!row) return null;
    return Subscription.fromPrimitives({
      id: row.id,
      userId: row.user_id,
      plan: row.plan,
      status: row.status as SubscriptionStatus,
      trialEndsAt: row.trial_ends_at,
      currentPeriodEnd: row.current_period_end,
      canceledAt: row.canceled_at,
      createdAt: row.created_at,
    });
  }

  public async recordSimulatedPayment(
    subscriptionId: string,
    amount: number,
    currency: string,
    idempotencyKey: string | null = null,
  ): Promise<void> {
    await this.db.execute(
      `INSERT INTO subscription_payments
           (id, subscription_id, amount, currency, provider, paid_at, idempotency_key)
         VALUES (?, ?, ?, ?, 'simulado', ?, ?)`,
      [randomUUID(), subscriptionId, amount, currency, new Date().toISOString(), idempotencyKey],
    );
  }

  public async hasPaymentWithKey(idempotencyKey: string): Promise<boolean> {
    const row = await this.db.queryRow<{ x: number }>(
      'SELECT 1 AS x FROM subscription_payments WHERE idempotency_key = ? LIMIT 1',
      [idempotencyKey],
    );
    return row !== null;
  }
}
