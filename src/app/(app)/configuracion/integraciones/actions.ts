'use server';

import { revalidatePath } from 'next/cache';
import { isPaymentGatewayProvider } from '@/contexts/practitioner/domain/paymentGateways';
import { PaymentCheckoutUrl } from '@/contexts/practitioner/domain/value-objects/PaymentCheckoutUrl';
import { isIntegrationSecretKey } from '@/contexts/practitioner/domain/integrationCredentials';
import { paymentCheckoutIsSimulated } from '@/contexts/practitioner/infrastructure/payments/createPaymentCheckoutProvider';
import { SqlitePaymentGatewayRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePaymentGatewayRepository';
import {
  requireClinicalConfigAccess,
  requirePaymentConfigurationAccess,
} from '@/shared/infrastructure/auth/dataOwner';
import {
  clearIntegrationCredentials,
  isIntegrationProvider,
  saveIntegrationCredentials,
} from './integrationConnections';

export interface IntegracionFormState {
  ok?: string;
  error?: string;
}

export async function saveIntegrationAction(
  _prev: IntegracionFormState,
  formData: FormData,
): Promise<IntegracionFormState> {
  const provider = String(formData.get('provider') ?? '');
  if (!isIntegrationProvider(provider)) return { error: 'Integración desconocida.' };

  try {
    const ownerUserId = isPaymentGatewayProvider(provider)
      ? await requirePaymentConfigurationAccess()
      : await requireClinicalConfigAccess();
    const config: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== 'string' || !key.startsWith('config_')) continue;
      const configKey = key.slice('config_'.length);
      const normalized = value.trim();
      // Los secretos ya guardados nunca vuelven al navegador. Vacío significa
      // "conservar"; borrarlos requiere la acción explícita Desconectar.
      if (isIntegrationSecretKey(configKey) && normalized === '') continue;
      config[configKey] = normalized;
    }
    const status = await saveIntegrationCredentials(provider, config, ownerUserId);
    revalidatePath('/configuracion/integraciones');
    return {
      ok:
        status === 'conectado'
          ? 'Credenciales guardadas localmente. Integración marcada como conectada.'
          : 'Credenciales vacías. Integración marcada como desconectada.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la integración.' };
  }
}

/**
 * Guarda la configuración MANUAL / avanzada de una pasarela de cobro
 * (Stripe / Mercado Pago / PayPal): credenciales o link de pago + toggle
 * "Mostrar botón de pago a mis pacientes". Hace merge sobre la config
 * existente, así que NO borra la vinculación OAuth si la hay.
 */
export async function savePaymentGatewayAction(
  _prev: IntegracionFormState,
  formData: FormData,
): Promise<IntegracionFormState> {
  const provider = String(formData.get('provider') ?? '');
  if (!isPaymentGatewayProvider(provider)) return { error: 'Pasarela desconocida.' };

  try {
    const config: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value !== 'string' || !key.startsWith('config_')) continue;
      const configKey = key.slice('config_'.length);
      const normalized = value.trim();
      if (isIntegrationSecretKey(configKey) && normalized === '') continue;
      config[configKey] = normalized;
    }
    // El checkbox no viaja en el FormData cuando está apagado.
    config.show_payment_button = formData.get('config_show_payment_button') === 'true' ? 'true' : 'false';
    const manualCheckoutUrl =
      provider === 'stripe'
        ? config.payment_link
        : provider === 'mercado_pago'
          ? config.checkout_link
          : config.paypal_me;
    if (manualCheckoutUrl) PaymentCheckoutUrl.create(provider, manualCheckoutUrl);
    const settings = await new SqlitePaymentGatewayRepository().saveManualConfig(
      provider,
      await requirePaymentConfigurationAccess(),
      config,
    );
    revalidatePath('/configuracion/integraciones');
    return {
      ok: settings.configured
        ? paymentCheckoutIsSimulated(settings)
          ? 'Pasarela lista en modo local. Falta un enlace de pago válido para cobrar fuera de la simulación.'
          : 'Enlace de pago listo. Tus pacientes serán redirigidos al sitio seguro de la pasarela.'
        : 'Configuración guardada. Conecta tu cuenta con un clic o agrega credenciales para activar la pasarela.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo guardar la pasarela.' };
  }
}

/**
 * "Desvincular" la cuenta conectada con un clic: quita linked_account_id /
 * linked_at / link_method. Las credenciales manuales (si las hay) y el
 * toggle del botón de pago se conservan.
 */
export async function unlinkPaymentGatewayAction(
  _prev: IntegracionFormState,
  formData: FormData,
): Promise<IntegracionFormState> {
  const provider = String(formData.get('provider') ?? '');
  if (!isPaymentGatewayProvider(provider)) return { error: 'Pasarela desconocida.' };
  try {
    const settings = await new SqlitePaymentGatewayRepository().unlinkAccount(
      provider,
      await requirePaymentConfigurationAccess(),
    );
    revalidatePath('/configuracion/integraciones');
    return {
      ok: settings.configured
        ? 'Cuenta desvinculada. La pasarela sigue activa con tu configuración manual.'
        : 'Cuenta desvinculada. Vuelve a conectarla con un clic cuando quieras.',
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo desvincular la cuenta.' };
  }
}

export async function disconnectIntegrationAction(
  _prev: IntegracionFormState,
  formData: FormData,
): Promise<IntegracionFormState> {
  const provider = String(formData.get('provider') ?? '');
  if (!isIntegrationProvider(provider)) return { error: 'Integración desconocida.' };
  try {
    const ownerUserId = isPaymentGatewayProvider(provider)
      ? await requirePaymentConfigurationAccess()
      : await requireClinicalConfigAccess();
    await clearIntegrationCredentials(provider, ownerUserId);
    revalidatePath('/configuracion/integraciones');
    return { ok: 'Integración desconectada y credenciales eliminadas.' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'No se pudo desconectar la integración.' };
  }
}
