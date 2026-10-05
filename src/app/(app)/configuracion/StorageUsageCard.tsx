import Link from 'next/link';
import { HardDrive, Sparkles, TriangleAlert } from 'lucide-react';

/** Bytes → texto humano compacto (0 MB, 740 KB, 1.2 GB), sin ceros sobrantes. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded =
    value >= 100 ? Math.round(value) : value >= 10 ? parseFloat(value.toFixed(1)) : parseFloat(value.toFixed(2));
  return `${rounded} ${units[unit]}`;
}

/**
 * Guía visual del almacenamiento de adjuntos del dueño (Configuración). Muestra una
 * barra de uso/cuota con color por nivel (ok/aviso/crítico) o "ilimitado" para el admin.
 * Los datos vienen de getStorageUsage(); el texto de expedientes/sesiones NO ocupa cuota.
 */
export function StorageUsageCard({
  usedBytes,
  limitBytes,
  planName,
  desktopEdition = false,
}: {
  usedBytes: number;
  limitBytes: number | null;
  planName: string;
  desktopEdition?: boolean;
}) {
  const unlimited = limitBytes === null;
  const pct = unlimited || limitBytes === 0 ? 0 : Math.min(100, Math.round((usedBytes / limitBytes) * 100));
  const tone = unlimited ? 'unlimited' : pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'ok';
  const barColor = tone === 'danger' ? 'bg-danger' : tone === 'warning' ? 'bg-warning' : 'bg-primary';
  const pctColor = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-primary dark:text-accent-2';

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
            <HardDrive size={18} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-ink">Almacenamiento</h2>
            <p className="text-xs text-ink-soft">Archivos que adjuntas a tus pacientes</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-bg px-3 py-1 text-xs font-medium text-ink-soft">
          {desktopEdition ? 'Disco de esta PC' : `Plan ${planName}`}
        </span>
      </div>

      {unlimited ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <Sparkles size={16} className="shrink-0" /> {desktopEdition ? `Sin cuota de plan · ${formatBytes(usedBytes)} en uso` : `Almacenamiento ilimitado · ${formatBytes(usedBytes)} en uso`}
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-1.5 flex items-end justify-between gap-3">
            <p className="text-sm text-ink">
              <span className="text-lg font-bold text-ink">{formatBytes(usedBytes)}</span>
              <span className="text-ink-soft"> de {formatBytes(limitBytes)}</span>
            </p>
            <span className={`text-sm font-bold ${pctColor}`}>{pct}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg">
            <div
              className={`h-full rounded-full ${barColor} transition-all`}
              style={{ width: pct === 0 ? '0%' : `${Math.max(2, pct)}%` }}
            />
          </div>
          {tone === 'danger' ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
              <TriangleAlert size={13} className="shrink-0" /> Estás cerca del límite. Libera espacio borrando
              archivos que no necesites, o amplía tu plan.
            </p>
          ) : tone === 'warning' ? (
            <p className="mt-2 text-xs text-warning">Llevas más de la mitad de tu cuota.</p>
          ) : null}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-soft">
        Aquí cuentan las fotos, PDFs y documentos que subes en cada paciente. El texto de los
        expedientes, sesiones y notas no ocupa cuota. {desktopEdition ? 'El espacio disponible depende del disco de esta PC.' : ''}
        {!unlimited && tone !== 'ok' ? (
          <>
            {' '}
            <Link href="/configuracion/suscripcion" className="font-medium text-primary dark:text-accent-2 hover:underline">
              Ver planes
            </Link>
          </>
        ) : null}
      </p>
    </section>
  );
}
