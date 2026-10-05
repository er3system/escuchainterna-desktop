'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import type { MonthlyHistoryPoint } from '@/contexts/billing/domain/repositories/DashboardMetricsReader';

const MX_NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** Abrevia montos grandes para el eje (1.5M, 200k) — evita etiquetas larguísimas. */
function abbreviateAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (abs >= 1_000) return `${Math.round(value / 1_000)}k`;
  return MX_NUMBER.format(value);
}

function monthLabel(month: string): string {
  const date = parse(month, 'yyyy-MM', new Date());
  return format(date, 'MMM yy', { locale: es });
}

/** Monedas presentes en el histórico, ordenadas por monto total descendente. */
function currenciesInHistory(history: MonthlyHistoryPoint[]): string[] {
  const totals = new Map<string, number>();
  for (const point of history) {
    for (const [code, amount] of Object.entries(point.incomeByCurrency)) {
      totals.set(code, (totals.get(code) ?? 0) + amount);
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}

/**
 * Histórico de 12 meses: barras de ingreso (una moneda a la vez) + línea de sesiones.
 * Si el psicólogo cobró en varias monedas, ofrece un selector para elegir cuál ver
 * (sumar COP + USD en un mismo número no significaría nada). `defaultCurrency` es la
 * moneda preferida del perfil; se usa como selección inicial si aparece en los datos.
 */
export function HistoryChart({
  history,
  defaultCurrency,
}: {
  history: MonthlyHistoryPoint[];
  defaultCurrency: string;
}) {
  const currencies = useMemo(() => currenciesInHistory(history), [history]);
  const initial = currencies.includes(defaultCurrency) ? defaultCurrency : currencies[0] ?? defaultCurrency;
  const [picked, setPicked] = useState(initial);
  // Si el conjunto de monedas cambia y la elegida ya no está, recae en la primera.
  const selected = currencies.includes(picked) ? picked : currencies[0] ?? defaultCurrency;

  const data = useMemo(
    () =>
      history.map((point) => ({
        label: monthLabel(point.month),
        sessions: point.sessions,
        income: point.incomeByCurrency[selected] ?? 0,
      })),
    [history, selected],
  );

  return (
    <div>
      {currencies.length > 1 ? (
        <div className="mb-2 flex items-center justify-end gap-2">
          <label htmlFor="historico-moneda" className="text-xs text-ink-soft">
            Moneda:
          </label>
          <select
            id="historico-moneda"
            value={selected}
            onChange={(event) => setPicked(event.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-ink"
          >
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      ) : currencies.length === 1 ? (
        <div className="mb-2 text-right text-xs text-ink-soft">Ingresos en {currencies[0]}</div>
      ) : null}

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: 'var(--color-ink-soft)' }}
              axisLine={{ stroke: 'var(--color-line)' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="ingresos"
              orientation="left"
              tickFormatter={(value: number) => `$${abbreviateAmount(value)}`}
              tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <YAxis
              yAxisId="sesiones"
              orientation="right"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip
              formatter={(value: number | string, name: string) =>
                name === 'Ingresos'
                  ? [`$ ${MX_NUMBER.format(Number(value))} ${selected}`, name]
                  : [MX_NUMBER.format(Number(value)), name]
              }
              contentStyle={{
                borderRadius: 12,
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-ink)',
                border: '1px solid var(--color-line)',
                boxShadow: 'var(--shadow-card)',
                fontSize: 13,
              }}
              labelStyle={{ color: 'var(--color-ink)' }}
              itemStyle={{ color: 'var(--color-ink)' }}
            />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar
              yAxisId="ingresos"
              dataKey="income"
              name="Ingresos"
              fill="var(--color-primary)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Line
              yAxisId="sesiones"
              type="monotone"
              dataKey="sessions"
              name="Sesiones"
              stroke="var(--color-success)"
              strokeWidth={2}
              dot={{ r: 2.5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
