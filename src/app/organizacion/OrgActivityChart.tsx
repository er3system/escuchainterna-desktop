'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import type { OrgActivityPoint } from '@/contexts/identity/domain/repositories/OrganizationInsightsReader';

const CO_NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

function monthLabel(month: string): string {
  return format(parse(month, 'yyyy-MM', new Date()), 'MMM yy', { locale: es });
}

/** Actividad de los últimos 12 meses: sesiones del equipo por mes (área). */
export function OrgActivityChart({ points }: { points: OrgActivityPoint[] }) {
  const data = points.map((point) => ({ ...point, label: monthLabel(point.month) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="orgSessionsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="orgCompletedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
            axisLine={{ stroke: 'var(--color-line)' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tickFormatter={(value: number) => CO_NUMBER.format(value)}
            tick={{ fontSize: 11, fill: 'var(--color-ink-soft)' }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip
            formatter={(value: number | string, name: string) => [CO_NUMBER.format(Number(value)), name]}
            labelFormatter={(label: string) => `Mes: ${label}`}
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
          <Area
            type="monotone"
            dataKey="sessions"
            name="Sesiones"
            stroke="var(--color-primary)"
            strokeWidth={2}
            fill="url(#orgSessionsFill)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completadas"
            stroke="var(--color-success)"
            strokeWidth={2}
            fill="url(#orgCompletedFill)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
