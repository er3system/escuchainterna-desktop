'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { OrgSessionStatusBreakdown } from '@/contexts/identity/domain/repositories/OrganizationInsightsReader';

const CO_NUMBER = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Distribución de estados de sesión del mes en curso (dona). */
export function OrgSessionStatusChart({ breakdown }: { breakdown: OrgSessionStatusBreakdown }) {
  const data = [
    { name: 'Completadas', value: breakdown.completadas, color: 'var(--color-success)' },
    { name: 'Agendadas', value: breakdown.agendadas, color: 'var(--color-primary)' },
    { name: 'Canceladas', value: breakdown.canceladas, color: 'var(--color-warning)' },
    { name: 'Inasistencias', value: breakdown.inasistencias, color: 'var(--color-danger)' },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string, name: string) => [CO_NUMBER.format(Number(value)), name]}
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
