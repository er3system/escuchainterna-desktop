import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export type SubscriptionStatus = 'trial' | 'activa' | 'vencida' | 'cancelada';

export const TRIAL_DAYS = 7;
export const PERIOD_DAYS = 30;

export interface SubscriptionPrimitives {
  id: string;
  userId: string;
  plan: string;
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  /** Fecha en que el titular pidió cancelar (cancelar al fin de periodo). null = vigente. */
  canceledAt: string | null;
  createdAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Suscripción de un usuario: trial de 7 días y activación con pago simulado en local. */
export class Subscription extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly userId: string,
    private plan: string,
    private status: SubscriptionStatus,
    private readonly trialEndsAt: Date,
    private currentPeriodEnd: Date | null,
    private canceledAt: Date | null,
    private readonly createdAt: Date,
  ) {
    super();
  }

  /** Al registrarse: trial de 7 días. */
  public static startTrial(id: string, userId: string, now: Date = new Date()): Subscription {
    return new Subscription(
      id,
      userId,
      'profesional',
      'trial',
      new Date(now.getTime() + TRIAL_DAYS * DAY_MS),
      null,
      null,
      now,
    );
  }

  /** Cuentas creadas por el admin o cubiertas por su organización: activas sin pagar. */
  public static startActive(id: string, userId: string, now: Date = new Date()): Subscription {
    const subscription = new Subscription(id, userId, 'profesional', 'activa', now, null, null, now);
    subscription.currentPeriodEnd = new Date(now.getTime() + 365 * DAY_MS);
    return subscription;
  }

  public static fromPrimitives(primitives: SubscriptionPrimitives): Subscription {
    return new Subscription(
      primitives.id,
      primitives.userId,
      primitives.plan,
      primitives.status,
      new Date(primitives.trialEndsAt),
      primitives.currentPeriodEnd ? new Date(primitives.currentPeriodEnd) : null,
      primitives.canceledAt ? new Date(primitives.canceledAt) : null,
      new Date(primitives.createdAt),
    );
  }

  /** Pago simulado en local: activa la suscripción `periodDays` días (default 30). */
  public activate(now: Date = new Date(), periodDays: number = PERIOD_DAYS): void {
    const days = Number.isFinite(periodDays) && periodDays > 0 ? Math.trunc(periodDays) : PERIOD_DAYS;
    this.status = 'activa';
    this.currentPeriodEnd = new Date(now.getTime() + days * DAY_MS);
    // Pagar de nuevo levanta cualquier cancelación previa: vuelves a estar al corriente.
    this.canceledAt = null;
  }

  /** Cancelación inmediata y dura (status='cancelada'). La usa el admin/plataforma. */
  public cancel(): void {
    this.status = 'cancelada';
  }

  /**
   * Cancelación SELF-SERVICE «al fin de periodo»: marca la intención sin cortar el acceso.
   * El status sigue 'activa' y el acceso dura hasta currentPeriodEnd (ver isExpired); a partir
   * de ahí no se renueva. Reversible con resume() mientras el periodo siga vigente.
   */
  public requestCancellation(now: Date = new Date()): void {
    if (this.canceledAt === null) this.canceledAt = now;
  }

  /** Reanuda una suscripción cancelada (antes de que termine el periodo): vuelve a renovarse. */
  public resume(): void {
    this.canceledAt = null;
  }

  public isCanceled(): boolean {
    return this.canceledAt !== null;
  }

  public canceledAtDate(): Date | null {
    return this.canceledAt;
  }

  /** Cambia el plan elegido (id de la tabla `plans`: esencial | profesional | organizacion). */
  public switchPlan(plan: string): void {
    this.plan = plan;
  }

  public currentPlan(): string {
    return this.plan;
  }

  /**
   * El gate del layout privado: vencida si el trial terminó y no está activa
   * (o si fue marcada vencida/cancelada).
   */
  public isExpired(now: Date = new Date()): boolean {
    if (this.status === 'activa') {
      // Si se pidió cancelar, el acceso dura SOLO hasta el fin del periodo ya pagado; luego
      // caduca (no se renueva). Una activa NO cancelada no caduca por esta vía (no hay
      // auto-renovación todavía; el cron real vendrá con la pasarela de cobro).
      if (this.canceledAt && this.currentPeriodEnd) {
        return now.getTime() > this.currentPeriodEnd.getTime();
      }
      return false;
    }
    if (this.status === 'vencida' || this.status === 'cancelada') return true;
    return now.getTime() > this.trialEndsAt.getTime();
  }

  public isInTrial(now: Date = new Date()): boolean {
    return this.status === 'trial' && now.getTime() <= this.trialEndsAt.getTime();
  }

  public daysLeftInTrial(now: Date = new Date()): number {
    const remaining = this.trialEndsAt.getTime() - now.getTime();
    return remaining <= 0 ? 0 : Math.ceil(remaining / DAY_MS);
  }

  public subscriptionId(): string {
    return this.id;
  }

  public ownerUserId(): string {
    return this.userId;
  }

  public currentStatus(): SubscriptionStatus {
    return this.status;
  }

  public toPrimitives(): SubscriptionPrimitives {
    return {
      id: this.id,
      userId: this.userId,
      plan: this.plan,
      status: this.status,
      trialEndsAt: this.trialEndsAt.toISOString(),
      currentPeriodEnd: this.currentPeriodEnd ? this.currentPeriodEnd.toISOString() : null,
      canceledAt: this.canceledAt ? this.canceledAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
