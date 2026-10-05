export interface BillingProfile {
  fullName: string;
  currency: string;
  paymentPolicies: string;
  autoPaymentReminders: boolean;
  /** Datos fiscales/de contacto básicos para la factura (v2-spec §6.13). */
  professionalLicense: string;
  contactAddress: string;
  contactPhone: string;
  email: string;
}

/**
 * Lectura/escritura mínima del perfil del profesional que necesita billing:
 * nombre y políticas para los recordatorios, moneda para los montos, datos
 * fiscales básicos para la factura y el toggle de recordatorios automáticos.
 */
export interface BillingProfileRepository {
  findCurrent(): Promise<BillingProfile | null>;
  setAutoPaymentReminders(enabled: boolean): Promise<void>;
}
