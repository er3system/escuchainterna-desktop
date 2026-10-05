'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, CreditCard, ExternalLink, Info, Landmark, Wallet, X } from 'lucide-react';
import { Button } from '@/components/ui';
import type { PaymentCheckoutMode } from '@/contexts/practitioner/domain/PaymentCheckoutProvider';
import type { PaymentGatewayProvider } from '@/contexts/practitioner/domain/paymentGateways';
import { SUPPORTED_CURRENCIES, formatMoney } from '@/shared/domain/currencies';
import { convertPublicSessionAmountAction, payPublicSessionAction } from './actions';

export interface PublicGatewayOption {
  provider: PaymentGatewayProvider;
  label: string;
  mode: PaymentCheckoutMode;
  /** URL generada por el puerto PaymentCheckoutProvider. */
  checkoutUrl: string;
}

/**
 * Botón público "Paga tu consulta". Los enlaces manuales abren la pasarela
 * externa; sin un enlace válido, desarrollo conserva el checkout simulado.
 *
 * Incluye el selector "Pagar en: [moneda]" (conversión aproximada vía
 * server action; solo informativa: imita el multi-moneda nativo de Stripe
 * Adaptive Pricing / PayPal). Al confirmar, la sesión se marca como pagada
 * (MarkBookingPaid) SIEMPRE en su moneda original y la página se refresca
 * mostrando el estado "Pagada".
 */
export function PagarConsulta({
  bookingId,
  amount,
  currency,
  practitionerName,
  gateways,
  initialCheckout,
}: {
  bookingId: string;
  amount: number;
  currency: string;
  practitionerName: string;
  gateways: PublicGatewayOption[];
  initialCheckout: PaymentGatewayProvider | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialCheckout !== null);
  const [selected, setSelected] = useState<PaymentGatewayProvider>(
    initialCheckout ?? gateways[0]?.provider ?? 'mercado_pago',
  );
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Selector "Pagar en": moneda elegida por el paciente + monto aproximado.
  const [payCurrency, setPayCurrency] = useState(currency);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [converting, setConverting] = useState(false);

  if (gateways.length === 0) return null;

  const selectedGateway = gateways.find((gateway) => gateway.provider === selected) ?? gateways[0];
  const simulated = selectedGateway.mode === 'local_simulation';

  const changePayCurrency = (next: string) => {
    setPayCurrency(next);
    setConvertError(null);
    if (next === currency) {
      setConvertedAmount(null);
      return;
    }
    setConverting(true);
    void convertPublicSessionAmountAction({ bookingId, currency: next })
      .then((result) => {
        if (result.ok && typeof result.amount === 'number') {
          setConvertedAmount(result.amount);
        } else {
          setConvertedAmount(null);
          setConvertError(result.error ?? 'No se pudo calcular la conversión.');
        }
      })
      .finally(() => setConverting(false));
  };

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await payPublicSessionAction({ bookingId, provider: selectedGateway.provider });
      if (!result.ok) {
        setError(result.error ?? 'No se pudo registrar el pago. Intenta de nuevo.');
        return;
      }
      setPaid(true);
      router.refresh();
    });
  };

  const gatewayIcon = (provider: PaymentGatewayProvider, size = 16) =>
    provider === 'stripe' ? (
      <CreditCard size={size} />
    ) : provider === 'mercado_pago' ? (
      <Landmark size={size} />
    ) : (
      <Wallet size={size} />
    );

  // ----------------------------------------------------------- Pago exitoso
  if (paid) {
    return (
      <div className="rounded-card border border-line bg-success-soft p-6 text-center">
        <CheckCircle2 size={44} className="mx-auto text-success" />
        <p className="mt-3 text-lg font-bold text-ink">¡Pago registrado!</p>
        <p className="mt-1 text-sm text-ink-soft">
          Tu pago de <strong className="text-ink">{formatMoney(amount, currency)}</strong> vía{' '}
          {selectedGateway.label} quedó registrado. {practitionerName} ya puede verlo reflejado.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-primary px-6 py-4 text-base font-bold text-white shadow-card transition hover:bg-primary-dark"
      >
        <CreditCard size={20} />
        Paga tu consulta · {formatMoney(amount, currency)}
      </button>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-ink-soft">
        Pago directo a {practitionerName} con{' '}
        <span className="font-medium text-ink">{gateways.map((gateway) => gateway.label).join(' o ')}</span>
      </p>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Opciones de pago"
        >
          <div className="w-full max-w-md rounded-card border border-line bg-surface p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">Pagar consulta</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1 text-ink-soft transition hover:bg-bg hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-1 text-sm text-ink-soft">
              Monto: <strong className="text-ink">{formatMoney(amount, currency)}</strong> · directo a la cuenta de{' '}
              {practitionerName}.
            </p>

            {gateways.length > 1 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-ink">Elige cómo pagar:</p>
                {gateways.map((gateway) => (
                  <button
                    key={gateway.provider}
                    type="button"
                    onClick={() => setSelected(gateway.provider)}
                    className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                      selectedGateway.provider === gateway.provider
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-line bg-surface text-ink hover:bg-bg'
                    }`}
                  >
                    {gatewayIcon(gateway.provider)}
                    {gateway.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2.5 text-sm font-medium text-ink">
                {gatewayIcon(selectedGateway.provider)}
                {selectedGateway.label}
              </p>
            )}

            {simulated ? (
              <div className="mt-4 rounded-lg border border-line bg-bg px-3 py-2.5">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-xs font-semibold text-ink">Pagar en:</span>
                  <select
                    value={payCurrency}
                    onChange={(event) => changePayCurrency(event.target.value)}
                    className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
                  >
                    {SUPPORTED_CURRENCIES.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                {payCurrency !== currency ? (
                  <div className="mt-2 border-t border-line pt-2 text-xs text-ink-soft">
                    {converting ? (
                      <p>Calculando conversión…</p>
                    ) : convertError ? (
                      <p className="text-danger">{convertError}</p>
                    ) : convertedAmount !== null ? (
                      <p>
                        Pagarías aproximadamente{' '}
                        <strong className="text-ink">{formatMoney(convertedAmount, payCurrency)}</strong>{' '}
                        <span className="text-ink-soft">({formatMoney(amount, currency)})</span>
                      </p>
                    ) : null}
                    <p className="mt-1">
                      Conversión aproximada — el cargo final lo procesa {selectedGateway.label} según tu banco. Con
                      Stripe (Adaptive Pricing) y PayPal el pago multi-moneda es nativo; Mercado Pago cobra en la
                      moneda local del vendedor.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning bg-warning-soft px-3 py-2.5 text-xs text-ink">
              <Info size={14} className="mt-0.5 shrink-0 text-warning" />
              {simulated ? (
                <span>
                  <span className="font-semibold">Modo demostración:</span> el checkout real de{' '}
                  {selectedGateway.label} aún no está conectado. El pago se simula y la sesión se
                  marca como pagada en su moneda original ({currency}).
                </span>
              ) : (
                <span>
                  <span className="font-semibold">Pago externo seguro:</span> continuarás al sitio de{' '}
                  {selectedGateway.label}. EscuchaInterna no recibe tus datos financieros y la sesión seguirá
                  pendiente hasta que el profesional confirme el pago.
                </span>
              )}
            </div>

            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              {simulated ? (
                <Button
                  type="button"
                  disabled={pending}
                  onClick={confirm}
                >
                  {pending ? 'Procesando…' : `Confirmar pago con ${selectedGateway.label}`}
                </Button>
              ) : (
                <a
                  href={selectedGateway.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer external nofollow"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
                >
                  Continuar a {selectedGateway.label} <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
