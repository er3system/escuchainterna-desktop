'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  isPaymentGatewayProvider,
  newSimulatedLinkedAccountId,
} from '@/contexts/practitioner/domain/paymentGateways';
import { SqlitePaymentGatewayRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePaymentGatewayRepository';
import { requirePaymentConfigurationAccess } from '@/shared/infrastructure/auth/dataOwner';
import { safeReturnPath } from './conectarMeta';

/**
 * "Autorizar" de la pantalla simulada de vinculación (/conectar/[provider]).
 *
 * Simula el retorno del OAuth real (Stripe Connect / Mercado Pago OAuth /
 * PayPal Partner Referrals): guarda en la pasarela del dueño un
 * linked_account_id de demostración, linked_at, link_method 'oauth' y deja
 * el botón de pago visible por defecto. El estado queda 'simulado'
 * (en producción 'conectado' lo pondría el callback real del proveedor).
 */
export async function authorizeSimulatedLinkAction(formData: FormData): Promise<void> {
  const provider = String(formData.get('provider') ?? '');
  const volver = safeReturnPath(String(formData.get('volver') ?? ''));
  if (!isPaymentGatewayProvider(provider)) redirect(volver);

  const ownerUserId = await requirePaymentConfigurationAccess();
  await new SqlitePaymentGatewayRepository().linkAccount(
    provider,
    ownerUserId,
    newSimulatedLinkedAccountId(provider),
  );
  revalidatePath('/configuracion/integraciones');
  redirect(volver);
}
