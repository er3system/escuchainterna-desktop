import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { InitialProfileInput, ProfileProvisioner } from '../../domain/ProfileProvisioner';

/**
 * Adaptador que crea el perfil profesional inicial en practitioner_profile
 * (anticorrupción mínima: identity no importa clases del contexto practitioner).
 */
export class SqliteProfileProvisioner implements ProfileProvisioner {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async createInitialProfile(input: InitialProfileInput): Promise<void> {
    const existing = await this.db.queryRow<{ id: string }>(
      'SELECT id FROM practitioner_profile WHERE user_id = ?',
      [input.userId],
    );
    if (existing) return;
    // Moneda por defecto COP (v3 §8 Colombia-first) para perfiles creados en el registro.
    await this.db.execute(
      `INSERT INTO practitioner_profile (id, user_id, full_name, phone, phone_country_code, public_slug, currency)
         VALUES (?, ?, ?, ?, ?, ?, 'COP')`,
      [
        randomUUID(),
        input.userId,
        input.fullName,
        input.phone,
        input.phoneCountryCode,
        `consulta-${randomUUID().slice(0, 8)}`,
      ],
    );
  }

  public async updateFullName(userId: string, fullName: string): Promise<void> {
    await this.db.execute('UPDATE practitioner_profile SET full_name = ? WHERE user_id = ?', [
      fullName.trim(),
      userId,
    ]);
  }
}
