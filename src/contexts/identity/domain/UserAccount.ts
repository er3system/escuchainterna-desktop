import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import type { UserRole } from './value-objects/UserRole';

export type UserStatus = 'activo' | 'suspendido';

export interface UserAccountPrimitives {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdBy: string | null;
  createdAt: string;
}

/** Cuenta de usuario v2: con rol de plataforma y estado (activo/suspendido). */
export class UserAccount extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private email: string,
    private passwordHash: string,
    private role: UserRole,
    private status: UserStatus,
    private readonly createdBy: string | null,
    private readonly createdAt: Date,
  ) {
    super();
  }

  /** Registro público: SIEMPRE crea rol psychologist. Los demás roles los crea el admin. */
  public static registerPublic(id: string, email: string, passwordHash: string): UserAccount {
    return new UserAccount(id, email.toLowerCase().trim(), passwordHash, 'psychologist', 'activo', null, new Date());
  }

  /** Alta hecha por el admin o por una organización (rol explícito, sin paywall). */
  public static provision(
    id: string,
    email: string,
    passwordHash: string,
    role: UserRole,
    createdBy: string | null,
  ): UserAccount {
    return new UserAccount(id, email.toLowerCase().trim(), passwordHash, role, 'activo', createdBy, new Date());
  }

  public static fromPrimitives(primitives: UserAccountPrimitives): UserAccount {
    return new UserAccount(
      primitives.id,
      primitives.email,
      primitives.passwordHash,
      primitives.role,
      primitives.status,
      primitives.createdBy,
      new Date(primitives.createdAt),
    );
  }

  public accountId(): string {
    return this.id;
  }

  public accountEmail(): string {
    return this.email;
  }

  public accountRole(): UserRole {
    return this.role;
  }

  public isSuspended(): boolean {
    return this.status === 'suspendido';
  }

  public storedPasswordHash(): string {
    return this.passwordHash;
  }

  public changePassword(newPasswordHash: string): void {
    this.passwordHash = newPasswordHash;
  }

  /** Cambia el rol de plataforma (acción de admin; el llamador audita y protege casos como auto-degradación). */
  public changeRole(role: UserRole): void {
    this.role = role;
  }

  /** Cambia el correo (acción de admin); normaliza igual que en el alta. El llamador valida unicidad. */
  public changeEmail(email: string): void {
    this.email = email.toLowerCase().trim();
  }

  public suspend(): void {
    this.status = 'suspendido';
  }

  public reactivate(): void {
    this.status = 'activo';
  }

  public toPrimitives(): UserAccountPrimitives {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
