import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { BillingProfile, BillingProfileRepository } from '../../domain/repositories/BillingProfileRepository';

interface ProfileRow {
  full_name: string;
  currency: string;
  payment_policies: string;
  auto_payment_reminders: number;
  professional_license: string;
  contact_address: string;
  contact_phone: string;
  email: string | null;
}

/** Perfil de cobro del profesional dueño de la sesión. */
export class SqliteBillingProfileRepository implements BillingProfileRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findCurrent(): Promise<BillingProfile | null> {
    const row = await this.db.queryRow<ProfileRow>(
      `SELECT pp.full_name, pp.currency, pp.payment_policies, pp.auto_payment_reminders,
                pp.professional_license, pp.contact_address, pp.contact_phone,
                u.email AS email
         FROM practitioner_profile pp
         LEFT JOIN users u ON u.id = pp.user_id
         WHERE pp.user_id = ? LIMIT 1`,
      [this.ownerUserId],
    );
    if (!row) return null;
    return {
      fullName: row.full_name,
      currency: row.currency || 'MXN',
      paymentPolicies: row.payment_policies,
      autoPaymentReminders: row.auto_payment_reminders === 1,
      professionalLicense: row.professional_license ?? '',
      contactAddress: row.contact_address ?? '',
      contactPhone: row.contact_phone ?? '',
      email: row.email ?? '',
    };
  }

  public async setAutoPaymentReminders(enabled: boolean): Promise<void> {
    await this.db.execute('UPDATE practitioner_profile SET auto_payment_reminders = ? WHERE user_id = ?', [
      enabled ? 1 : 0,
      this.ownerUserId,
    ]);
  }
}
