'use client';

import { useEffect, useState } from 'react';
import type { DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, FileText, GripVertical, Layers } from 'lucide-react';
import { Badge } from '@/components/ui';
import { SESSION_KIND_LABELS, type SessionKind } from '@/contexts/clinical-records/domain/sessionTemplates';
import { SessionArchiveButton } from './SessionArchiveButton';
import { reorderSessionsAction } from '../sesiones/actions';

export interface TimelineItem {
  id: string;
  title: string;
  sessionKind: SessionKind;
  hasTemplate: boolean;
  createdAt: string;
  preview: string;
  tecnicas: string[];
  riesgo: string | null;
  pago: 'pagada' | 'pendiente' | null;
  blockCount: number;
}

/** Tono del riesgo de una sesión (mismo criterio que el banner del Resumen). */
function riskTone(risk: string): 'danger' | 'warning' {
  return /alto|sever|crí|crit|inminente/i.test(risk) ? 'danger' : 'warning';
}

/**
 * Línea de tiempo de sesiones de la Evolución, REORDENABLE arrastrando por el
 * tirador (P8). El orden visual (arriba→abajo) se persiste como `position` ASC,
 * que es el mismo orden del Documento, así el reordenamiento es WYSIWYG.
 */
export function SessionTimeline({
  patientId,
  base,
  selectedId,
  items,
  historia = null,
  historiaSelected = false,
}: {
  patientId: string;
  base: string;
  selectedId: string | null;
  items: TimelineItem[];
  /** La Historia clínica vigente, mostrada como el PRIMER nodo del flujo (la apertura). */
  historia?: { modelTitle: string } | null;
  historiaSelected?: boolean;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(items);
  const [dragId, setDragId] = useState<string | null>(null);

  // Resincroniza con el servidor cuando cambia el conjunto/orden de sesiones
  // (crear, archivar, o tras persistir el reorden); evita estado obsoleto.
  const key = items.map((item) => item.id).join(',');
  useEffect(() => {
    setOrder(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function handleDragOver(event: DragEvent, overId: string) {
    event.preventDefault();
    if (!dragId || dragId === overId) return;
    setOrder((prev) => {
      const from = prev.findIndex((item) => item.id === dragId);
      const to = prev.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleDrop() {
    if (!dragId) return;
    setDragId(null);
    const orderedIds = order.map((item) => item.id);
    // Si la acción se rechaza (offline / sesión expirada), refresca igual para
    // re-sincronizar desde el servidor y no dejar el orden divergente ni la
    // promesa sin manejar.
    void reorderSessionsAction(patientId, orderedIds)
      .then(() => router.refresh())
      .catch(() => router.refresh());
  }

  // La Historia clínica es la APERTURA del expediente: primer nodo del flujo, con el
  // mismo lenguaje visual que las sesiones pero distinguida (icono + "Apertura"). Por
  // ahora va fija al inicio; las sesiones se reordenan entre sí arrastrando.
  const historiaNode = historia ? (
    <li className="relative">
      <span
        className={`absolute -left-[1.3rem] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-primary ${
          historiaSelected ? 'ring-2 ring-primary/30' : ''
        }`}
      />
      <Link
        href={`${base}?vista=evolucion&sel=historia`}
        className={`flex items-center gap-2.5 rounded-card border bg-surface px-3 py-2.5 shadow-card transition ${
          historiaSelected ? 'border-primary ring-1 ring-primary/30' : 'border-line hover:border-primary/50'
        }`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <FileText size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">Historia clínica</span>
            <Badge tone="primary">Apertura</Badge>
          </span>
          {historia.modelTitle ? (
            <span className="mt-0.5 block truncate text-xs text-ink-soft">{historia.modelTitle}</span>
          ) : null}
        </span>
      </Link>
    </li>
  ) : null;

  if (order.length === 0 && !historia) {
    return (
      <p className="rounded-card border border-dashed border-line bg-surface px-4 py-6 text-center text-xs text-ink-soft">
        Aún no hay sesiones. Crea la primera con «Registrar sesión».
      </p>
    );
  }

  return (
    <ol className="space-y-2.5 border-l-2 border-line pl-4">
      {historiaNode}
      {order.map((note) => {
        const selected = selectedId === note.id;
        const dragging = dragId === note.id;
        return (
          <li
            key={note.id}
            className="relative"
            onDragOver={(event) => handleDragOver(event, note.id)}
            onDrop={handleDrop}
          >
            <span
              className={`absolute -left-[1.3rem] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                note.riesgo ? (riskTone(note.riesgo) === 'danger' ? 'bg-danger' : 'bg-warning') : 'bg-primary'
              } ${selected ? 'ring-2 ring-primary/30' : ''}`}
            />
            <div
              className={`flex items-stretch rounded-card border bg-surface shadow-card transition ${
                selected ? 'border-primary ring-1 ring-primary/30' : 'border-line hover:border-primary/50'
              } ${dragging ? 'opacity-50' : ''}`}
            >
              <button
                type="button"
                draggable
                onDragStart={() => setDragId(note.id)}
                onDragEnd={() => setDragId(null)}
                className="flex shrink-0 cursor-grab items-center rounded-l-card px-1 text-ink-soft hover:bg-bg hover:text-ink active:cursor-grabbing"
                title="Arrastra para reordenar"
                aria-label="Reordenar sesión"
              >
                <GripVertical size={15} />
              </button>
              <div className="min-w-0 flex-1 py-2.5 pr-2.5">
                <Link href={`${base}?vista=evolucion&sesion=${note.id}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-ink">{note.title}</span>
                      {note.hasTemplate ? <Badge tone="primary">{SESSION_KIND_LABELS[note.sessionKind]}</Badge> : null}
                    </span>
                    <span className="text-xs text-ink-soft">
                      {format(new Date(note.createdAt), 'd MMM', { locale: es })}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{note.preview}</p>
                </Link>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {note.tecnicas.slice(0, 2).map((t) => (
                      <span key={t} className="rounded bg-bg px-1.5 py-0.5 text-[11px] text-ink-soft">
                        {t}
                      </span>
                    ))}
                    {note.blockCount > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded bg-primary-light px-1.5 py-0.5 text-[11px] font-medium text-primary">
                        <Layers size={10} /> {note.blockCount}
                      </span>
                    ) : null}
                    {note.riesgo ? (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          riskTone(note.riesgo) === 'danger'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-warning-soft text-warning'
                        }`}
                      >
                        <AlertTriangle size={10} /> {note.riesgo.toLowerCase()}
                      </span>
                    ) : null}
                    {note.pago ? (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] ${
                          note.pago === 'pagada' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                        }`}
                      >
                        {note.pago === 'pagada' ? 'Pagada' : 'Pendiente'}
                      </span>
                    ) : null}
                  </div>
                  <SessionArchiveButton noteId={note.id} patientId={patientId} archived={false} />
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
