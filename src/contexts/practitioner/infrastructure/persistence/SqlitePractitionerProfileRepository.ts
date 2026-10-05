import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import {
  PractitionerProfilePrimitives,
  PractitionerProfileRepository,
} from '../../domain/repositories/PractitionerProfileRepository';

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  phone_country_code: string;
  description: string;
  photo_path: string | null;
  public_slug: string;
  modality: string;
  address: string;
  maps_url: string;
  currency: string;
  default_price: number;
  payment_mode: string;
  show_price: number;
  payment_policies: string;
  availability_json: string;
  session_reminder_hours: number;
  cancellation_min_hours: number;
  auto_payment_reminders: number;
  onboarding_completed: number;
  professional_license: string;
  contact_address: string;
  contact_phone: string;
  no_show_fee_enabled: number;
  no_show_fee_amount: number;
  late_cancel_fee_enabled: number;
  late_cancel_fee_amount: number;
  email_theme: string;
}

export class SqlitePractitionerProfileRepository implements PractitionerProfileRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async createEmptyProfileFor(userId: string): Promise<void> {
    // Defaults Colombia-first (v3 §8): indicativo +57 y moneda COP para perfiles nuevos.
    await this.db.execute(
      `INSERT INTO practitioner_profile (id, user_id, public_slug, phone_country_code, currency)
         VALUES (?, ?, ?, '+57', 'COP')`,
      [randomUUID(), userId, `consulta-${randomUUID().slice(0, 8)}`],
    );
  }

  public async findByUserId(userId: string): Promise<PractitionerProfilePrimitives | null> {
    const row = await this.db.queryRow<ProfileRow>(
      'SELECT * FROM practitioner_profile WHERE user_id = ?',
      [userId],
    );
    return row ? this.hydrate(row) : null;
  }

  public async update(profile: PractitionerProfilePrimitives): Promise<void> {
    await this.db.execute(
      `UPDATE practitioner_profile SET
          full_name = ?, phone = ?, phone_country_code = ?, description = ?, photo_path = ?,
          public_slug = ?, modality = ?, address = ?, maps_url = ?, currency = ?, default_price = ?,
          payment_mode = ?, show_price = ?, payment_policies = ?, availability_json = ?,
          session_reminder_hours = ?, cancellation_min_hours = ?, auto_payment_reminders = ?,
          onboarding_completed = ?, professional_license = ?, contact_address = ?, contact_phone = ?,
          no_show_fee_enabled = ?, no_show_fee_amount = ?, late_cancel_fee_enabled = ?,
          late_cancel_fee_amount = ?, email_theme = ?
         WHERE id = ?`,
      [
        profile.fullName,
        profile.phone,
        profile.phoneCountryCode,
        profile.description,
        profile.photoPath,
        profile.publicSlug,
        profile.modality,
        profile.address,
        profile.mapsUrl,
        profile.currency,
        profile.defaultPrice,
        profile.paymentMode,
        profile.showPrice ? 1 : 0,
        profile.paymentPolicies,
        JSON.stringify(profile.availability),
        profile.sessionReminderHours,
        profile.cancellationMinHours,
        profile.autoPaymentReminders ? 1 : 0,
        profile.onboardingCompleted ? 1 : 0,
        profile.professionalLicense,
        profile.contactAddress,
        profile.contactPhone,
        profile.noShowFeeEnabled ? 1 : 0,
        profile.noShowFeeAmount,
        profile.lateCancelFeeEnabled ? 1 : 0,
        profile.lateCancelFeeAmount,
        profile.emailTheme,
        profile.id,
      ],
    );
  }

  private hydrate(row: ProfileRow): PractitionerProfilePrimitives {
    return {
      id: row.id,
      userId: row.user_id,
      fullName: row.full_name,
      phone: row.phone,
      phoneCountryCode: row.phone_country_code || '+52',
      description: row.description,
      photoPath: row.photo_path,
      publicSlug: row.public_slug,
      modality: row.modality,
      address: row.address,
      mapsUrl: row.maps_url,
      currency: row.currency,
      defaultPrice: row.default_price,
      paymentMode: row.payment_mode,
      showPrice: row.show_price === 1,
      paymentPolicies: row.payment_policies,
      availability: JSON.parse(row.availability_json || '[]'),
      sessionReminderHours: row.session_reminder_hours,
      cancellationMinHours: row.cancellation_min_hours,
      autoPaymentReminders: row.auto_payment_reminders === 1,
      onboardingCompleted: row.onboarding_completed === 1,
      professionalLicense: row.professional_license ?? '',
      contactAddress: row.contact_address ?? '',
      contactPhone: row.contact_phone ?? '',
      noShowFeeEnabled: row.no_show_fee_enabled === 1,
      noShowFeeAmount: row.no_show_fee_amount ?? 0,
      lateCancelFeeEnabled: row.late_cancel_fee_enabled === 1,
      lateCancelFeeAmount: row.late_cancel_fee_amount ?? 0,
      emailTheme: row.email_theme || 'calido',
    };
  }
}
