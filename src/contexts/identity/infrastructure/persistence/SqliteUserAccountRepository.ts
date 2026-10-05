import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { UserAccount, type UserAccountPrimitives, type UserStatus } from '../../domain/UserAccount';
import { isUserRole, type UserRole } from '../../domain/value-objects/UserRole';
import type { UserAccountRepository } from '../../domain/repositories/UserAccountRepository';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  status: string;
  created_by: string | null;
  created_at: string;
}

function toPrimitives(row: UserRow): UserAccountPrimitives {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: (isUserRole(row.role) ? row.role : 'psychologist') as UserRole,
    status: (row.status === 'suspendido' ? 'suspendido' : 'activo') as UserStatus,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export class SqliteUserAccountRepository implements UserAccountRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(account: UserAccount): Promise<void> {
    const primitives = account.toPrimitives();
    await this.db.execute(
      `INSERT INTO users (id, email, password_hash, role, status, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           email = excluded.email,
           password_hash = excluded.password_hash,
           role = excluded.role,
           status = excluded.status`,
      [
        primitives.id,
        primitives.email,
        primitives.passwordHash,
        primitives.role,
        primitives.status,
        primitives.createdBy,
        primitives.createdAt,
      ],
    );
  }

  public async findByEmail(email: string): Promise<UserAccount | null> {
    const row = await this.db.queryRow<UserRow>('SELECT * FROM users WHERE email = ?', [
      email.toLowerCase().trim(),
    ]);
    return row ? UserAccount.fromPrimitives(toPrimitives(row)) : null;
  }

  public async findById(id: string): Promise<UserAccount | null> {
    const row = await this.db.queryRow<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    return row ? UserAccount.fromPrimitives(toPrimitives(row)) : null;
  }

  /**
   * Marca el correo verificado (doble opt-in). Vive fuera del agregado UserAccount
   * a propósito: es un flag de plataforma (no clínico) que no participa en las reglas
   * de la cuenta, igual que session_epoch. Idempotente: re-verificar solo refresca la fecha.
   */
  public async markEmailVerified(userId: string): Promise<void> {
    await this.db.execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [
      new Date().toISOString(),
      userId,
    ]);
  }

  /**
   * Sella la aceptación de T&C + aviso de privacidad al registrarse (Ley 1581): qué
   * versión de cada documento y cuándo. Igual que markEmailVerified, es metadato de
   * plataforma fuera del agregado. La fecha la pone el repo (momento del alta).
   */
  public async recordTermsAcceptance(
    userId: string,
    termsVersion: string,
    privacyVersion: string,
  ): Promise<void> {
    await this.db.execute(
      'UPDATE users SET terms_accepted_at = ?, terms_version = ?, privacy_version = ? WHERE id = ?',
      [new Date().toISOString(), termsVersion, privacyVersion, userId],
    );
  }
}
