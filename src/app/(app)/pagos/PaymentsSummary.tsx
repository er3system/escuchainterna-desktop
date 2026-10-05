'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRightLeft, Coins, Info, Wallet } from 'lucide-react';
import type { CurrencyAmount } from '@/contexts/billing/domain/value-objects/currencyTotals';
import { formatMoney, SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { Card } from '@/components/ui';
import { convertTotalsAction, type ConvertedTotals } from './actions';

const STORAGE_KEY = 'escuchainterna:pagos:moneda-totales';

/**
 * Cards «Cobrado» y «Por cobrar» del filtro actual con UN RENGLÓN POR MONEDA,
 * selector «Ver totales en:» (persistido en localStorage) y botón de
 * conversión aproximada con tasas del día (solo informativo).
 */
export function PaymentsSummary({
  collected,
  pending,
  profileCurrency,
}: {
  collected: CurrencyAmount[];
  pending: CurrencyAmount[];
  profileCurrency: string;
}) {
  const [target, setTarget] = useState(profileCurrency);
  const [conversion, setConversion] = useState<ConvertedTotals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();

  // La elección de moneda persiste entre visitas (localStorage, solo cliente).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_CURRENCIES.some((item) => item.code === stored)) {
      setTarget(stored);
    }
  }, []);

  // Si cambian los totales (filtros) la conversión previa deja de aplicar.
  const totalsKey = useMemo(() => JSON.stringify({ collected, pending }), [collected, pending]);
  useEffect(() => {
    setConversion(null);
    setError(null);
  }, [totalsKey]);

  const chooseTarget = (code: string) => {
    setTarget(code);
    window.localStorage.setItem(STORAGE_KEY, code);
    setConversion(null);
    setError(null);
  };

  const convert = () => {
    setError(null);
    startTransition(async () => {
      const result = await convertTotalsAction({ targetCurrency: target, collected, pending });
      if (!result.ok || !result.conversion) {
        setError(result.error ?? 'No se pudo calcular la conversión.');
        return;
      }
      setConversion(result.conversion);
    });
  };

  return (
    <div className="mb-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TotalsCard
          icon={<Coins size={20} />}
          iconClass="bg-success-soft text-success"
          label="Cobrado (filtro actual)"
          totals={collected}
          fallbackCurrency={profileCurrency}
        />
        <TotalsCard
          icon={<Wallet size={20} />}
          iconClass="bg-warning-soft text-warning"
          label="Por cobrar (filtro actual)"
          totals={pending}
          fallbackCurrency={profileCurrency}
          valueClass="text-warning"
          codeClass="text-warning/70"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-2.5 shadow-card">
        <label htmlFor="moneda-totales" className="text-sm font-medium text-ink-soft">
          Ver totales en:
        </label>
        <select
          id="moneda-totales"
          value={target}
          onChange={(event) => chooseTarget(event.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.code} — {currency.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pendingAction}
          onClick={convert}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-50"
        >
          <ArrowRightLeft size={14} />
          {pendingAction ? 'Calculando…' : 'Conversión aproximada'}
        </button>
        {error ? <span className="text-sm text-danger">{error}</span> : null}
      </div>

      {conversion ? (
        <div className="mt-3 rounded-card border border-line bg-primary-light/40 dark:bg-primary/15 px-4 py-3 shadow-card">
          <p className="text-sm font-semibold text-ink">
            ≈ {formatMoney(conversion.collected, conversion.target)} {conversion.target} cobrado · ≈{' '}
            {formatMoney(conversion.pending, conversion.target)} {conversion.target} por cobrar
          </p>
          {conversion.skipped.length > 0 ? (
            <p className="mt-1 text-xs text-warning">
              Sin tasa disponible (se muestran aparte, sin convertir):{' '}
              {conversion.skipped
                .map(
                  (item) =>
                    `${formatMoney(item.collected, item.currency)} cobrado · ${formatMoney(
                      item.pending,
                      item.currency,
                    )} por cobrar`,
                )
                .join(' / ')}
            </p>
          ) : null}
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
            <Info size={12} />
            Tasas aproximadas de hoy (fuente: {conversion.source}) ·{' '}
            {format(new Date(conversion.fetchedAt), "d MMM yyyy, h:mm a", { locale: es })} · Solo
            informativo, no es un tipo de cambio oficial.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function TotalsCard({
  icon,
  iconClass,
  label,
  totals,
  fallbackCurrency,
  valueClass = 'text-ink',
  codeClass = 'text-ink-soft',
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  totals: CurrencyAmount[];
  fallbackCurrency: string;
  /** Color del monto (p. ej. ámbar para "Por cobrar"). */
  valueClass?: string;
  /** Color del código de moneda junto al monto. */
  codeClass?: string;
}) {
  const lines = totals.length > 0 ? totals : [{ currency: fallbackCurrency, amount: 0 }];
  return (
    <Card className="flex items-center gap-4">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconClass}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink-soft">{label}</p>
        {lines.map((line) => (
          <p
            key={line.currency}
            className={`font-bold ${valueClass} ${lines.length > 1 ? 'text-xl' : 'text-2xl'}`}
          >
            {formatMoney(line.amount, line.currency)}{' '}
            <span className={`text-sm font-semibold ${codeClass}`}>{line.currency}</span>
          </p>
        ))}
      </div>
    </Card>
  );
}
