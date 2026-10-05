import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface PasswordResetTokenPrimitives {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  used: boolean;
  createdAt: string;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Token de recuperación de contraseña: expira en 1 hora y es de un solo uso. */
export class PasswordResetToken extends AggregateRoot {
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

  public static issue(id: string, userId: string, token: string, now: Date = new Date()): PasswordResetToken {
    return new PasswordResetToken(id, userId, token, new Date(now.getTime() + ONE_HOUR_MS), false, now);
  }

  public static fromPrimitives(primitives: PasswordResetTokenPrimitives): PasswordResetToken {
    return new PasswordResetToken(
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

  public toPrimitives(): PasswordResetTokenPrimitives {
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
