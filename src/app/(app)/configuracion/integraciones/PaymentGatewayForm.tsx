'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Link2, Unplug } from 'lucide-react';
import {
  MERCADO_PAGO_COUNTRIES,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_GATEWAY_OAUTH_FLOW,
  parsePaymentGatewaySettings,
  type PaymentGatewayProvider,
} from '@/contexts/practitioner/domain/paymentGateways';
import { REDACTED_INTEGRATION_SECRET } from '@/contexts/practitioner/domain/integrationCredentials';
import {
  disconnectIntegrationAction,
  savePaymentGatewayAction,
  unlinkPaymentGatewayAction,
  type IntegracionFormState,
} from './actions';
import { Button, Input, Select } from '@/components/ui';

const INITIAL: IntegracionFormState = {};
type PaymentGatewayFormAction = 'save' | 'unlink' | 'disconnect';

/**
 * Pasarela de cobro (Stripe / Mercado Pago / PayPal).
 *
 * Camino PRINCIPAL: vinculación "con un clic" → /conectar/[provider]
 * (pantalla simulada de autorización del proveedor). Camino alternativo:
 * credenciales/link manuales dentro de <details> "Configuración manual /
 * avanzada". Ambos incluyen el toggle "Mostrar botón de pago a mis pacientes".
 */
export function PaymentGatewayForm({
  provider,
  currentConfig,
  configurationRevision,
}: {
  provider: PaymentGatewayProvider;
  currentConfig: Record<string, string>;
  configurationRevision: string;
}) {
  const gatewayName = PAYMENT_GATEWAY_LABELS[provider];
  const settings = parsePaymentGatewaySettings(provider, currentConfig);
  const stripeSecretStored = currentConfig.secret_key === REDACTED_INTEGRATION_SECRET;
  const mercadoPagoTokenStored = currentConfig.access_token === REDACTED_INTEGRATION_SECRET;
  const linked = settings.linkedAccountId !== '';
  const [showButton, setShowButton] = useState(currentConfig.show_payment_button === 'true');
  const [saveState, saveDispatch, savePending] = useActionState(savePaymentGatewayAction, INITIAL);
  const [unlinkState, unlinkDispatch, unlinkPending] = useActionState(unlinkPaymentGatewayAction, INITIAL);
  const [disconnectState, disconnectDispatch, disconnectPending] = useActionState(
    disconnectIntegrationAction,
    INITIAL,
  );
  const [lastAction, setLastAction] = useState<PaymentGatewayFormAction>('save');
  useEffect(() => {
    setShowButton(currentConfig.show_payment_button === 'true');
  }, [configurationRevision, currentConfig.show_payment_button]);

  const activeState =
    lastAction === 'unlink' ? unlinkState : lastAction === 'disconnect' ? disconnectState : saveState;
  const feedback = activeState.error ?? activeState.ok;
  const isError = Boolean(activeState.error);

  return (
    <div className="mt-3 border-t border-line pt-3">
      {linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-medium text-success">
            <Link2 size={13} />
            Cuenta vinculada (modo local) · <span className="font-mono">{settings.linkedAccountId}</span>
          </span>
          <form action={unlinkDispatch} onSubmit={() => setLastAction('unlink')}>
            <input type="hidden" name="provider" value={provider} />
            <button
              type="submit"
              disabled={unlinkPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
            >
              <Unplug size={13} /> {unlinkPending ? 'Desvinculando…' : 'Desvincular'}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/conectar/${provider}?volver=/configuracion/integraciones`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <Link2 size={15} /> Conectar con {gatewayName}
          </Link>
          <p className="text-xs text-ink-soft">
            Un clic: autorizas en {gatewayName} ({PAYMENT_GATEWAY_OAUTH_FLOW[provider]}) y listo, sin copiar
            credenciales.
          </p>
        </div>
      )}

      <details className="group mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-soft transition hover:text-ink [&::-webkit-details-marker]:hidden">
          Configuración manual / avanzada
          <ChevronDown size={13} className="transition-transform group-open:rotate-180" />
        </summary>

        <form
          key={configurationRevision}
          action={saveDispatch}
          onSubmit={(event) => {
            const submitter = (event.nativeEvent as SubmitEvent).submitter;
            setLastAction(
              submitter instanceof HTMLButtonElement && submitter.dataset.integrationAction === 'disconnect'
                ? 'disconnect'
                : 'save',
            );
          }}
          className="mt-3 max-w-lg space-y-3"
        >
          <input type="hidden" name="provider" value={provider} />

          {provider === 'stripe' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="st-secret-key">
                  Secret key de tu cuenta de Stripe:
                </label>
                <Input
                  id="st-secret-key"
                  name="config_secret_key"
                  type="password"
                  defaultValue={stripeSecretStored ? '' : (currentConfig.secret_key ?? '')}
                  placeholder={stripeSecretStored ? 'Credencial guardada; escribe para reemplazarla' : 'sk_live_…'}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  La encuentras en dashboard.stripe.com → Developers → API keys.
                </p>
              </div>
              <p className="text-center text-xs font-medium text-ink-soft">— o, si prefieres lo más sencillo —</p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="st-payment-link">
                  Payment Link de Stripe:
                </label>
                <Input
                  id="st-payment-link"
                  name="config_payment_link"
                  type="url"
                  defaultValue={currentConfig.payment_link ?? ''}
                  placeholder="https://buy.stripe.com/…"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Crea un Payment Link con el monto de tu consulta desde tu dashboard de Stripe y pégalo aquí.
                </p>
              </div>
            </>
          ) : provider === 'mercado_pago' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="mp-access-token">
                  Access Token de tu cuenta:
                </label>
                <Input
                  id="mp-access-token"
                  name="config_access_token"
                  type="password"
                  defaultValue={mercadoPagoTokenStored ? '' : (currentConfig.access_token ?? '')}
                  placeholder={
                    mercadoPagoTokenStored
                      ? 'Credencial guardada; escribe para reemplazarla'
                      : 'APP_USR-…'
                  }
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Lo encuentras en Mercado Pago → Tu negocio → Configuración → Credenciales de producción.
                </p>
              </div>
              <p className="text-center text-xs font-medium text-ink-soft">— o, si prefieres lo más sencillo —</p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="mp-checkout-link">
                  Link de Checkout Pro / link de pago:
                </label>
                <Input
                  id="mp-checkout-link"
                  name="config_checkout_link"
                  type="url"
                  defaultValue={currentConfig.checkout_link ?? ''}
                  placeholder="https://mpago.la/…"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Crea un link de pago con el monto de tu consulta desde tu panel de Mercado Pago y pégalo aquí.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="mp-country">
                  País de tu cuenta de Mercado Pago:
                </label>
                <Select
                  id="mp-country"
                  name="config_country"
                  defaultValue={currentConfig.country ?? 'MX'}
                >
                  {MERCADO_PAGO_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="pp-client-id">
                  Client ID de tu cuenta PayPal Business:
                </label>
                <Input
                  id="pp-client-id"
                  name="config_client_id"
                  type="text"
                  defaultValue={currentConfig.client_id ?? ''}
                  placeholder="AeA…"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Lo encuentras en developer.paypal.com → Apps &amp; Credentials.
                </p>
              </div>
              <p className="text-center text-xs font-medium text-ink-soft">— o, si prefieres lo más sencillo —</p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink" htmlFor="pp-paypal-me">
                  Tu enlace PayPal.me:
                </label>
                <Input
                  id="pp-paypal-me"
                  name="config_paypal_me"
                  type="url"
                  defaultValue={currentConfig.paypal_me ?? ''}
                  placeholder="https://paypal.me/tunombre"
                  autoComplete="off"
                />
              </div>
            </>
          )}

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-bg px-3 py-2.5">
            <span>
              <span className="block text-xs font-semibold text-ink">Mostrar botón de pago a mis pacientes</span>
              <span className="block text-xs text-ink-soft">
                Tus pacientes verán «Paga tu consulta» en su página de sesión y en la liga de pago de WhatsApp.
              </span>
            </span>
            <input
              type="checkbox"
              name="config_show_payment_button"
              value="true"
              checked={showButton}
              onChange={(event) => setShowButton(event.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${showButton ? 'bg-primary' : 'bg-line'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                  showButton ? 'left-4.5' : 'left-0.5'
                }`}
              />
            </span>
          </label>

          <p className="text-xs text-ink-soft">
            Los secretos se guardan cifrados y no vuelven a enviarse al navegador. Dejarlos vacíos los conserva;
            «Deshabilitar y borrar credenciales» los elimina. Un enlace manual válido abre el sitio seguro de{' '}
            {gatewayName}; la sesión permanece pendiente hasta que confirmes el cobro. Las credenciales sin enlace
            conservan el modo de demostración mientras se completa la integración API y sus webhooks.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={savePending || disconnectPending || unlinkPending}>
              {savePending ? 'Guardando…' : 'Guardar configuración'}
            </Button>
            {settings.configured && !linked ? (
              <button
                type="submit"
                formAction={disconnectDispatch}
                data-integration-action="disconnect"
                disabled={disconnectPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-danger transition hover:bg-danger-soft disabled:opacity-60"
              >
                <Unplug size={13} /> {disconnectPending ? 'Deshabilitando…' : 'Deshabilitar y borrar credenciales'}
              </button>
            ) : null}
          </div>
        </form>
      </details>

      {feedback ? (
        <p className={`mt-2 text-xs ${isError ? 'text-danger' : 'text-success'}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
