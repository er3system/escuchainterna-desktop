import type { AgendaModality, AgendaPaymentMode } from './Agenda';
import type { DayAvailabilityPrimitives } from './value-objects/WeeklyAvailability';

/** Tarifa configurable por inasistencia o cancelación tardía (spec v2 §6.3). */
export interface PenaltyFeePolicy {
  enabled: boolean;
  amount: number;
}

/**
 * Puerto de solo lectura hacia la configuración global del profesional
 * (perfil): disponibilidad, tarifas, ubicación y reglas de cancelación.
 */
export interface GlobalSchedulingDefaults {
  practitionerName: string;
  availability: DayAvailabilityPrimitives[];
  currency: string;
  defaultPrice: number;
  paymentMode: AgendaPaymentMode;
  showPrice: boolean;
  paymentPolicies: string;
  /** Permiso efectivo de cobro; false prevalece sobre tarifas globales y de agenda. */
  paymentsEnabled?: boolean;
  modality: AgendaModality;
  address: string;
  mapsUrl: string;
  cancellationMinHours: number;
  noShowFee: PenaltyFeePolicy;
  lateCancelFee: PenaltyFeePolicy;
}

export interface SchedulingSettings {
  getDefaults(): Promise<GlobalSchedulingDefaults>;
}
