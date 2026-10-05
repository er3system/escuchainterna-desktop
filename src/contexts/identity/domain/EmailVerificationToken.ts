import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface EmailVerificationTokenPrimitives {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Token de verificación de correo (doble opt-in): expira en 7 días (la
 * verificación NO es urgente, a diferencia del reset de contraseña que dura 1h)
 * y es de un solo uso.
 */
export class EmailVerificationToken extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly userId: string,
    private readonly token: string,
    private readonly expiresAt: Date,
    private used: boolean,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static issue(id: string, userId: string, token: string, now: Date = new Date()): EmailVerificationToken {
    return new EmailVerificationToken(id, userId, token, new Date(now.getTime() + SEVEN_DAYS_MS), false, now);
  }

  public static fromPrimitives(primitives: EmailVerificationTokenPrimitives): EmailVerificationToken {
    return new EmailVerificationToken(
      primitives.id,
      primitives.userId,
      primitives.token,
      new Date(primitives.expiresAt),
      primitives.used,
      new Date(primitives.createdAt),
    );
  }

  public isValid(now: Date = new Date()): boolean {
    return !this.used && now.getTime() <= this.expiresAt.getTime();
  }

  public consume(): void {
    this.used = true;
  }

  public tokenValue(): string {
    return this.token;
  }

  public tokenOwnerUserId(): string {
    return this.userId;
  }

  public toPrimitives(): EmailVerificationTokenPrimitives {
    return {
      id: this.id,
      userId: this.userId,
      token: this.token,
      expiresAt: this.expiresAt.toISOString(),
      used: this.used,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
