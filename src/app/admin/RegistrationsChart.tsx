'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegistrationsPoint {
  day: string;
  count: number;
}

/** Registros de usuarios por día (últimos 30 días) del dashboard de /admin. */
export function RegistrationsChart({ points }: { points: RegistrationsPoint[] }) {
  const data = points.map((point) => ({
    ...point,
    label: format(parseISO(point.day), 'd MMM', { locale: es }),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
          <XAxis
            dataKey="label"
            interval={4}
            tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
            axisLine={{ stroke: 'var(--color-line)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            formatter={(value: number | string) => [String(value), 'Registros']}
            labelFormatter={(label: string) => `Día: ${label}`}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--color-line)',
              boxShadow: 'var(--shadow-card)',
              fontSize: 13,
            }}
          />
          <Bar dataKey="count" name="Registros" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
