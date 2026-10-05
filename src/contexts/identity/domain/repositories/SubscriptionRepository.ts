import { Subscription } from '../Subscription';

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findByUserId(userId: string): Promise<Subscription | null>;
  /**
   * Registra el pago simulado en subscription_payments (modo local). Si se pasa
   * `idempotencyKey`, queda sellada en la fila (el índice único impide duplicar el cobro
   * ante un reintento con la misma clave).
   */
  recordSimulatedPayment(
    subscriptionId: string,
    amount: number,
    currency: string,
    idempotencyKey?: string | null,
  ): Promise<void>;
  /** true si ya existe un pago con esa clave de idempotencia (reintento ya aplicado). */
  hasPaymentWithKey(idempotencyKey: string): Promise<boolean>;
}
