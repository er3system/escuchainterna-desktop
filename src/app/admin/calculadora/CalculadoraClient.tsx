'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { orgSeatPrice } from '@/shared/domain/orgSeatPricing';

const COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Umbral a partir del cual conviene mover adjuntos a object storage (operativo). */
const STORAGE_VPS_GB = 50;

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light"
        />
        {suffix ? <span className="shrink-0 text-sm text-ink-soft">{suffix}</span> : null}
      </div>
      {help ? <span className="mt-1 block text-xs text-ink-soft">{help}</span> : null}
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={`text-sm ${strong ? 'font-semibold text-ink' : 'text-ink-soft'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${strong ? 'font-bold text-ink' : 'text-ink'}`}>{value}</span>
    </div>
  );
}

export function CalculadoraClient() {
  // Uso
  const [seats, setSeats] = useState(6);
  const [sessionsPerSeat, setSessionsPerSeat] = useState(80);
  const [pctAi, setPctAi] = useState(40);
  const [pctSonnet, setPctSonnet] = useState(20);
  const [gbAttachments, setGbAttachments] = useState(5);
  // Costos (editables; COP)
  const [haikuCop, setHaikuCop] = useState(27);
  const [sonnetCop, setSonnetCop] = useState(82);
  const [hostingCop, setHostingCop] = useState(130_000);
  const [storageCopPerGb, setStorageCopPerGb] = useState(50);
  const [individualPrice, setIndividualPrice] = useState(149_000);

  const r = useMemo(() => {
    const quote = orgSeatPrice(seats);
    const totalSessions = quote.seats * Math.max(0, sessionsPerSeat);
    const aiSessions = (totalSessions * Math.min(100, Math.max(0, pctAi))) / 100;
    const sonnet = (aiSessions * Math.min(100, Math.max(0, pctSonnet))) / 100;
    const haiku = Math.max(0, aiSessions - sonnet);
    const aiCost = haiku * haikuCop + sonnet * sonnetCop;
    const storageCost = Math.max(0, gbAttachments) * Math.max(0, storageCopPerGb);
    const costToServe = hostingCop + aiCost + storageCost;
    const revenue = quote.monthlyTotal;
    const margin = revenue - costToServe;
    const marginPct = revenue > 0 ? margin / revenue : 0;
    const discount = individualPrice > 0 ? Math.max(0, 1 - quote.pricePerSeat / individualPrice) : 0;
    return { quote, totalSessions, aiSessions, aiCost, storageCost, costToServe, revenue, margin, marginPct, discount };
  }, [seats, sessionsPerSeat, pctAi, pctSonnet, gbAttachments, haikuCop, sonnetCop, hostingCop, storageCopPerGb, individualPrice]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
      {/* Entradas */}
      <div className="space-y-4">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-ink">Uso de la organización</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Profesionales (asientos)" value={seats} onChange={setSeats} min={2} help="2+ = plan organización; 1 = individual." />
            <NumberField label="Sesiones / profesional / mes" value={sessionsPerSeat} onChange={setSessionsPerSeat} />
            <NumberField label="% de sesiones que usan IA" value={pctAi} onChange={setPctAi} suffix="%" />
            <NumberField label="% de esas que usan Sonnet" value={pctSonnet} onChange={setPctSonnet} suffix="%" help="El resto usa Haiku (más barato)." />
            <NumberField label="Adjuntos almacenados" value={gbAttachments} onChange={setGbAttachments} suffix="GB" />
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-ink">Supuestos de costo (COP, editables)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField label="Costo Haiku / consulta" value={haikuCop} onChange={setHaikuCop} suffix="COP" />
            <NumberField label="Costo Sonnet / consulta" value={sonnetCop} onChange={setSonnetCop} suffix="COP" />
            <NumberField label="Hosting / mes (fijo por cuenta)" value={hostingCop} onChange={setHostingCop} suffix="COP" />
            <NumberField label="Almacenamiento / GB / mes" value={storageCopPerGb} onChange={setStorageCopPerGb} suffix="COP" help="Object storage ~25–60 COP/GB; en disco del VPS ~0 hasta el umbral." />
            <NumberField label="Precio plan individual (referencia)" value={individualPrice} onChange={setIndividualPrice} suffix="COP" />
          </div>
        </div>
      </div>

      {/* Resultados */}
      <div className="space-y-4">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-2 text-base font-semibold text-ink">Precio sugerido</h2>
          <p className="mb-3 text-xs text-ink-soft">Tramo: {r.quote.tier.label}</p>
          <Row label="Precio por profesional / mes" value={COP.format(r.quote.pricePerSeat)} />
          <Row label="Descuento vs individual" value={`${(r.discount * 100).toFixed(0)}%`} />
          <div className="mt-2 border-t border-line pt-2">
            <Row label={`Total mensual (${r.quote.seats} asientos)`} value={COP.format(r.revenue)} strong />
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-base font-semibold text-ink">Costo para ti / mes</h2>
          <Row label="Hosting" value={COP.format(hostingCop)} />
          <Row label={`IA (${Math.round(r.aiSessions)} consultas)`} value={COP.format(r.aiCost)} />
          <Row label={`Almacenamiento (${gbAttachments} GB)`} value={COP.format(r.storageCost)} />
          <div className="mt-2 border-t border-line pt-2">
            <Row label="Costo total de servir" value={COP.format(r.costToServe)} strong />
          </div>
        </div>

        <div
          className={`rounded-card border p-5 shadow-card ${
            r.margin >= 0 ? 'border-success bg-success-soft/40' : 'border-danger bg-danger-soft/40'
          }`}
        >
          <h2 className="mb-3 text-base font-semibold text-ink">Margen</h2>
          <Row label="Margen mensual" value={COP.format(r.margin)} strong />
          <Row label="Margen %" value={`${(r.marginPct * 100).toFixed(0)}%`} strong />
        </div>

        {gbAttachments > STORAGE_VPS_GB ? (
          <div className="flex items-start gap-2 rounded-card border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Con más de {STORAGE_VPS_GB} GB de adjuntos conviene mover los archivos a almacenamiento de
              objetos (o un disco mayor) y respaldos aparte. El costo en plata sigue siendo bajo; el límite
              es operativo (disco del VPS y respaldos).
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
