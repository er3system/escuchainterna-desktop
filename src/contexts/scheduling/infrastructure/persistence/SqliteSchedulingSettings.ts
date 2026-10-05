import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { ownerHasFreeService } from '@/contexts/identity/infrastructure/persistence/SqliteFreeServiceReader';
import { ownerCanActuallyCharge } from '@/shared/infrastructure/auth/dataOwner';
import type { AgendaModality, AgendaPaymentMode } from '../../domain/Agenda';
import type { GlobalSchedulingDefaults, SchedulingSettings } from '../../domain/SchedulingSettings';
import type { DayAvailabilityPrimitives } from '../../domain/value-objects/WeeklyAvailability';

interface ProfileRow {
  full_name: string;
  availability_json: string;
  currency: string;
  default_price: number;
  payment_mode: string;
  show_price: number;
  payment_policies: string;
  modality: string;
  address: string;
  maps_url: string;
  cancellation_min_hours: number;
  no_show_fee_enabled: number;
  no_show_fee_amount: number;
  late_cancel_fee_enabled: number;
  late_cancel_fee_amount: number;
}

const FALLBACK_DEFAULTS: GlobalSchedulingDefaults = {
  practitionerName: '',
  availability: [],
  currency: 'MXN',
  defaultPrice: 0,
  paymentMode: 'manual',
  showPrice: true,
  paymentPolicies: '',
  paymentsEnabled: false,
  modality: 'ambas',
  address: '',
  mapsUrl: '',
  cancellationMinHours: 24,
  noShowFee: { enabled: false, amount: 0 },
  lateCancelFee: { enabled: false, amount: 0 },
};

/** Lee la configuración de agendamiento desde el perfil del profesional dueño de la sesión. */
export class SqliteSchedulingSettings implements SchedulingSettings {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async getDefaults(): Promise<GlobalSchedulingDefaults> {
    const row = await this.db.queryRow<ProfileRow>(
      `SELECT full_name, availability_json, currency, default_price, payment_mode,
                show_price, payment_policies, modality, address, maps_url, cancellation_min_hours,
                no_show_fee_enabled, no_show_fee_amount, late_cancel_fee_enabled, late_cancel_fee_amount
         FROM practitioner_profile WHERE user_id = ? LIMIT 1`,
      [this.ownerUserId],
    );
    // v3 §3 (universidades — servicio sin costo): los mensajes y recordatorios
    // de los miembros no mencionan montos ni políticas de pago.
    const freeService = await ownerHasFreeService(this.ownerUserId);
    const paymentsEnabled = !freeService && (await ownerCanActuallyCharge(this.ownerUserId));
    if (!row) {
      return { ...FALLBACK_DEFAULTS, paymentsEnabled };
    }
    return {
      practitionerName: row.full_name,
      availability: JSON.parse(row.availability_json || '[]') as DayAvailabilityPrimitives[],
      currency: row.currency || 'MXN',
      defaultPrice: paymentsEnabled ? row.default_price : 0,
      paymentMode: (paymentsEnabled && row.payment_mode === 'requerido' ? 'requerido' : 'manual') as AgendaPaymentMode,
      showPrice: paymentsEnabled && row.show_price === 1,
      paymentPolicies: paymentsEnabled ? row.payment_policies : '',
      paymentsEnabled,
      modality: (['presencial', 'virtual', 'ambas'].includes(row.modality)
        ? row.modality
        : 'ambas') as AgendaModality,
      address: row.address,
      mapsUrl: row.maps_url,
      cancellationMinHours: row.cancellation_min_hours,
      noShowFee: {
        enabled: paymentsEnabled && row.no_show_fee_enabled === 1,
        amount: paymentsEnabled ? (row.no_show_fee_amount ?? 0) : 0,
      },
      lateCancelFee: {
        enabled: paymentsEnabled && row.late_cancel_fee_enabled === 1,
        amount: paymentsEnabled ? (row.late_cancel_fee_amount ?? 0) : 0,
      },
    };
  }
}
