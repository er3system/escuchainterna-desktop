'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OrgMemberSessionsPoint } from '@/contexts/identity/domain/repositories/OrganizationInsightsReader';

const CO_NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Sesiones del mes en curso por miembro (barras horizontales). */
export function OrgMemberSessionsChart({ points }: { points: OrgMemberSessionsPoint[] }) {
  // Altura proporcional al número de miembros para que las barras respiren.
  const height = Math.min(420, Math.max(200, points.length * 44));

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={points}
          layout="vertical"
          margin={{ top: 4, right: 24, bottom: 0, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tickFormatter={(value: number) => CO_NUMBER.format(value)}
            tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
            axisLine={{ stroke: 'var(--color-line)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="memberName"
            width={140}
            tick={{ fontSize: 12, fill: 'var(--color-ink)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number | string) => [CO_NUMBER.format(Number(value)), 'Sesiones']}
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
          <Bar
            dataKey="sessions"
            name="Sesiones"
            fill="var(--color-primary)"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
