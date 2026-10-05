import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  BellRing,
  ClipboardCheck,
  FileSignature,
  Paperclip,
  Users,
  Wallet,
} from 'lucide-react';
import { formatMoney } from '@/shared/domain/currencies';
import { Card } from '@/components/ui';

export interface PatientOverview {
  patientId: string;
  /** Saldo por cobrar por moneda (solo monedas con monto > 0). */
  pending: { currency: string; amount: number }[];
  /** Huecos del expediente; null = sin acceso clínico (no se muestra la sección). */
  gaps: string[] | null;
  fileCount: number;
  /** Reportes clínico-legales; null = sin acceso clínico. */
  reports: { total: number; signed: number } | null;
  /** Casos relacionales; null = sin acceso clínico. */
  relational: { count: number; contraindicado: boolean } | null;
  /** Recordatorios programados a futuro (próximos primero). */
  reminders: { id: string; title: string; remindAt: string }[];
}

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return format(d, "d MMM, HH:mm", { locale: es });
}

/** Fila-atajo: icono + etiqueta + valor a la derecha, enlazada a su pestaña. */
function ShortcutRow({
  icon: Icon,
  label,
  value,
  href,
  tone = 'normal',
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  href: string;
  tone?: 'normal' | 'warning';
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-bg"
    >
      <span className="flex items-center gap-2 text-sm text-ink">
        <Icon size={14} className={tone === 'warning' ? 'text-warning' : 'text-primary/70'} />
        {label}
      </span>
      <span className={`text-sm font-semibold ${tone === 'warning' ? 'text-warning' : 'text-ink'}`}>
        {value}
      </span>
    </Link>
  );
}

/**
 * "De un vistazo": capa operativa del Resumen (saldo, completitud del expediente,
 * atajos con contadores y próximos recordatorios). Todo son datos que ya viven en
 * otras pestañas; aquí solo se resumen y se enlazan. Las secciones clínicas se
 * ocultan al rol asistente (gaps/reports/relational llegan en null).
 */
export function PatientOverviewCard({ data }: { data: PatientOverview }) {
  const { patientId: id, pending, gaps, fileCount, reports, relational, reminders } = data;
  const base = `/pacientes/${id}`;

  return (
    <Card>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-ink-soft">De un vistazo</h3>

      {/* Saldo por cobrar */}
      <Link
        href={`${base}/pagos`}
        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-bg"
      >
        <span className="flex items-center gap-2 text-sm text-ink">
          <Wallet size={14} className={pending.length ? 'text-warning' : 'text-success'} />
          Por cobrar
        </span>
        <span className={`text-sm font-semibold ${pending.length ? 'text-warning' : 'text-success'}`}>
          {pending.length === 0
            ? 'Al día'
            : pending.map((p) => `${formatMoney(p.amount, p.currency)} ${p.currency}`).join(' · ')}
        </span>
      </Link>

      {/* Atajos con contadores */}
      {gaps !== null ? (
        <ShortcutRow icon={Paperclip} label="Archivos" value={String(fileCount)} href={`${base}/archivos`} />
      ) : null}
      {reports ? (
        <ShortcutRow
          icon={FileSignature}
          label="Reportes"
          value={reports.signed > 0 ? `${reports.signed} firmado(s) · ${reports.total}` : String(reports.total)}
          href={`${base}/exportar`}
        />
      ) : null}
      {relational && relational.count > 0 ? (
        <ShortcutRow
          icon={relational.contraindicado ? AlertTriangle : Users}
          label={relational.contraindicado ? 'Vínculos · contraindicado' : 'Vínculos'}
          value={String(relational.count)}
          href={`${base}/vinculos`}
          tone={relational.contraindicado ? 'warning' : 'normal'}
        />
      ) : null}

      {/* Próximos recordatorios programados */}
      {reminders.length > 0 ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            <BellRing size={12} className="text-primary/70" /> Recordatorios programados
          </p>
          <ul className="space-y-1">
            {reminders.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-xs text-ink">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0 text-ink-soft">{shortDateTime(r.remindAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Completitud del expediente (checklist de huecos) */}
      {gaps ? (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
            <ClipboardCheck size={12} className={gaps.length ? 'text-warning' : 'text-success'} />
            Completitud del expediente
          </p>
          {gaps.length === 0 ? (
            <p className="text-xs text-success">Expediente completo. Sin pendientes antes de firmar.</p>
          ) : (
            <>
              <ul className="space-y-1">
                {gaps.map((gap) => (
                  <li key={gap} className="flex items-start gap-1.5 text-xs text-ink-soft">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-warning" />
                    {gap}
                  </li>
                ))}
              </ul>
              <Link
                href={`${base}/exportar`}
                className="mt-1.5 inline-block text-xs font-medium text-primary dark:text-accent-2 hover:underline"
              >
                Completar antes de firmar →
              </Link>
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}
