'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Minus, Plus } from 'lucide-react';
import {
  orgSeatPrice,
  orgDiscountVsIndividual,
  formatCop,
  ORG_MIN_SEATS,
  type OrgSeatTier,
} from '@/shared/domain/orgSeatPricing';
import { formatApproxFromCop } from '@/shared/domain/planPricing';
import { EchoRings, EchoGlyph } from './Echo';

/** Tope del control: más allá de 20 la conversación pasa a ventas (mailto). */
const MAX_SEATS = 20;

const PRESETS: { seats: number; label: string }[] = [
  { seats: 3, label: 'Equipo pequeño' },
  { seats: 8, label: 'Clínica' },
  { seats: 15, label: 'Programa universitario' },
];

const VENTAS_MAILTO =
  'mailto:hola@escuchainterna.com?subject=Demostraci%C3%B3n%20para%20organizaciones';

export function OrgSeatCalculatorClient({
  tiers,
  individualRef,
  displayCurrency = 'COP',
  copRates,
}: {
  /** Tramos serializados (maxSeats: number | null en el tramo 10+). */
  tiers: OrgSeatTier[];
  /** Precio COP del plan individual de referencia (plan 'profesional'). */
  individualRef: number;
  /** Moneda del visitante (Accept-Language); COP = sin equivalente. */
  displayCurrency?: string;
  /** Tasas por 1 COP para el equivalente aproximado. */
  copRates?: Record<string, number>;
}) {
  // Arranca en el equipo mínimo: el primer render muestra una cifra real, no de ejemplo.
  const [seats, setSeats] = useState(ORG_MIN_SEATS);

  const clamp = (n: number) =>
    Math.max(ORG_MIN_SEATS, Math.min(MAX_SEATS, Math.trunc(n) || ORG_MIN_SEATS));

  const quote = useMemo(() => orgSeatPrice(seats), [seats]);
  const discount = useMemo(
    () => orgDiscountVsIndividual(seats, individualRef),
    [seats, individualRef],
  );
  const monthlySavings = Math.max(0, (individualRef - quote.pricePerSeat) * quote.seats);
  const activeTierIndex = tiers.findIndex((tier) => tier.minSeats === quote.tier.minSeats);
  const ringCount = Math.min(6, 2 + Math.max(0, activeTierIndex) * 2);
  const atTop = seats >= MAX_SEATS;
  const fillPct = ((seats - ORG_MIN_SEATS) / (MAX_SEATS - ORG_MIN_SEATS)) * 100;

  // aria-live "asentado": anuncia una sola vez tras estabilizar (sin spam al arrastrar).
  const [liveSummary, setLiveSummary] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setLiveSummary(
        `${seats}${atTop ? ' o más' : ''} profesionales: ${formatCop(quote.pricePerSeat)} por profesional al mes, total ${formatCop(quote.monthlyTotal)} al mes.`,
      );
    }, 450);
    return () => clearTimeout(timer);
  }, [seats, atTop, quote.pricePerSeat, quote.monthlyTotal]);

  return (
    <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
      {/* ── IZQUIERDA — controles ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-surface p-7 shadow-elev-sm sm:p-9">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const active = seats === preset.seats;
            return (
              <button
                key={preset.seats}
                type="button"
                onClick={() => setSeats(preset.seats)}
                aria-pressed={active}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-light ${
                  active
                    ? 'bg-primary text-white'
                    : 'border border-line text-ink-soft hover:border-primary hover:text-primary dark:hover:text-accent-2'
                }`}
              >
                {preset.label} ({preset.seats})
              </button>
            );
          })}
        </div>

        <label htmlFor="org-seats-input" className="mt-8 block text-sm font-semibold text-ink">
          ¿Cuántos profesionales?
        </label>

        {/* Stepper accesible (ruta de teclado y lectores de pantalla). */}
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSeats((s) => clamp(s - 1))}
            disabled={seats <= ORG_MIN_SEATS}
            aria-label="Quitar un profesional"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-primary hover:text-primary dark:hover:text-accent-2 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary-light"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <input
            id="org-seats-input"
            type="number"
            inputMode="numeric"
            min={ORG_MIN_SEATS}
            max={MAX_SEATS}
            value={seats}
            onChange={(event) => setSeats(clamp(Number(event.target.value)))}
            className="w-20 rounded-xl border border-line bg-bg px-3 py-2 text-center font-display text-2xl font-bold tabular-nums text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary-light"
          />
          <button
            type="button"
            onClick={() => setSeats((s) => clamp(s + 1))}
            disabled={seats >= MAX_SEATS}
            aria-label="Agregar un profesional"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-primary hover:text-primary dark:hover:text-accent-2 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary-light"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="ml-1 text-sm text-ink-soft">
            {atTop ? '20+ profesionales' : 'profesionales'}
          </span>
        </div>

        {/* Slider (control "héroe" que dispara las ondas). El relleno va por gradiente
            inline; el thumb se estiliza en globals.css (.range-eco). Sin accent-color
            para no duplicar el coloreado del track. */}
        <input
          type="range"
          min={ORG_MIN_SEATS}
          max={MAX_SEATS}
          step={1}
          value={seats}
          onChange={(event) => setSeats(clamp(Number(event.target.value)))}
          aria-label="Número de profesionales"
          aria-valuetext={`${seats}${atTop ? ' o más' : ''} profesionales, ${formatCop(quote.pricePerSeat)} por profesional al mes`}
          className="range-eco mt-6 w-full"
          style={{
            background: `linear-gradient(to right, var(--color-primary) ${fillPct}%, var(--color-line) ${fillPct}%)`,
          }}
        />

        {/* Desglose de los 3 tramos, con el activo resaltado (no solo por color). */}
        <ul className="mt-8 grid gap-2.5">
          {tiers.map((tier, index) => {
            const active = index === activeTierIndex;
            return (
              <li
                key={tier.minSeats}
                className={`flex items-center justify-between rounded-card border px-4 py-3 text-sm transition-colors ${
                  active ? 'ring-eco border-primary/60 bg-primary/5' : 'border-line bg-surface'
                }`}
              >
                <span className="flex items-center gap-2 font-medium text-ink">
                  {active ? (
                    <Check className="h-4 w-4 text-primary dark:text-accent-2" aria-hidden="true" />
                  ) : (
                    <span className="h-4 w-4" aria-hidden="true" />
                  )}
                  {tier.label}
                </span>
                <span className="font-display font-bold tabular-nums text-ink">
                  {formatCop(tier.pricePerSeat)}
                  {active && (
                    <span className="ml-1 text-xs font-semibold text-primary dark:text-accent-2">· Tu tramo</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── DERECHA — resultado en vivo, con el motivo de onda ─────────────── */}
      <output className="ring-eco relative flex min-h-[22rem] flex-col items-center justify-center overflow-hidden rounded-2xl bg-surface p-8 text-center shadow-elev-md">
        {/* La cifra-total es el punto-origen: el eco se propaga desde ella y crece con el equipo. */}
        <span className="relative inline-flex flex-col items-center justify-center">
          <EchoRings
            className="text-primary/20 dark:text-accent/20 motion-reduce:hidden"
            size="12rem"
            count={ringCount}
          />
          <span className="relative">
            <span className="block text-sm font-semibold uppercase tracking-wider text-primary dark:text-accent-2">
              Total mensual del equipo
            </span>
            <span className="mt-2 block font-display text-5xl font-extrabold tracking-tight tabular-nums text-ink sm:text-6xl">
              {formatCop(quote.monthlyTotal)}
            </span>
            <span className="mt-1 block text-sm text-ink-soft">
              {formatCop(quote.pricePerSeat)} por profesional · {atTop ? '20+' : seats} profesionales
            </span>
            {(() => {
              const approxTotal = formatApproxFromCop(quote.monthlyTotal, displayCurrency, copRates);
              return approxTotal ? (
                <span className="mt-1.5 block text-sm font-medium text-ink-soft">
                  ≈ {approxTotal} {displayCurrency} al mes
                </span>
              ) : null;
            })()}
          </span>
        </span>

        {discount > 0 && (
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-success-soft px-4 py-1.5 text-sm font-semibold text-success">
            <EchoGlyph size={16} className="text-success" />
            Ahorras {Math.round(discount * 100)}% · {formatCop(monthlySavings)}/mes frente al plan
            Profesional ({formatCop(individualRef)}/mes por profesional)
          </p>
        )}

        <p className="mt-6 max-w-xs text-xs leading-relaxed text-ink-soft">
          {atTop
            ? 'Ya tienes el mejor precio por profesional. ¿Más de 20 o un programa a la medida? Escríbenos y lo ajustamos contigo.'
            : displayCurrency !== 'COP' && copRates?.[displayCurrency]
              ? `Los precios de organización se facturan en COP; el equivalente en ${displayCurrency} es aproximado (tasa del día). El plan de equipo se activa con nuestro acompañamiento.`
              : 'Precios de organización en COP. El plan de equipo se activa con nuestro acompañamiento.'}
        </p>

        <div className="mt-6 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/registro"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-light"
          >
            Pruébala como profesional — 7 días
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <a
            href={VENTAS_MAILTO}
            className="inline-flex items-center justify-center rounded-full border border-line px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary dark:hover:text-accent-2"
          >
            Agenda una demostración
          </a>
        </div>

        {/* Región viva sólo para lectores: anuncia el resultado ya asentado (sin spam). */}
        <span className="sr-only" aria-live="polite">
          {liveSummary}
        </span>
      </output>
    </div>
  );
}
