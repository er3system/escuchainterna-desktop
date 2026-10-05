import type { PaymentGatewayProvider, PaymentGatewaySettings } from '../paymentGateways';

/**
 * Configuración de pasarelas de cobro DEL PROFESIONAL dueño:
 * cada psicólogo conecta su propia cuenta (sus pacientes le pagan directo).
 */
export interface PaymentGatewayRepository {
  find(provider: PaymentGatewayProvider, ownerUserId: string): Promise<PaymentGatewaySettings | null>;
  /** Pasarelas del dueño configuradas (vinculadas o manuales) Y con el toggle "mostrar botón de pago" activo. */
  listActiveForPatients(ownerUserId: string): Promise<PaymentGatewaySettings[]>;
  /**
   * Guarda la configuración manual / avanzada (merge clave a clave sobre la
   * config existente: NO borra la vinculación OAuth si la hay).
   */
  saveManualConfig(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
    config: Record<string, string>,
  ): Promise<PaymentGatewaySettings>;
  /**
   * Vincula la cuenta del profesional (flujo "con un clic"): persiste
   * linked_account_id, linked_at y link_method='oauth'; activa
   * show_payment_button por defecto (salvo que el dueño ya lo apagara).
   */
  linkAccount(
    provider: PaymentGatewayProvider,
    ownerUserId: string,
    linkedAccountId: string,
  ): Promise<PaymentGatewaySettings>;
  /** Quita la vinculación OAuth; conserva credenciales manuales y toggle. */
  unlinkAccount(provider: PaymentGatewayProvider, ownerUserId: string): Promise<PaymentGatewaySettings>;
}
