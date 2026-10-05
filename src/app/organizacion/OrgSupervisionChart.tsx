'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import type { OrgSupervisionActivityPoint } from '@/contexts/identity/domain/repositories/OrganizationInsightsReader';

const CO_NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

function monthLabel(month: string): string {
  return format(parse(month, 'yyyy-MM', new Date()), 'MMM yy', { locale: es });
}

/** Actividad de supervisión por mes: notas escritas vs notas revisadas. */
export function OrgSupervisionChart({ points }: { points: OrgSupervisionActivityPoint[] }) {
  const data = points.map((point) => ({ ...point, label: monthLabel(point.month) }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          <Bar
            dataKey="notesWritten"
            name="Notas escritas"
            fill="var(--color-primary)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
          <Bar
            dataKey="notesReviewed"
            name="Notas revisadas"
            fill="var(--color-success)"
            radius={[4, 4, 0, 0]}
            maxBarSize={18}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
