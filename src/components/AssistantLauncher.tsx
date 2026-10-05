'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2, Maximize2, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { AssistantChat } from '@/app/(app)/asistente/AssistantChat';
import { cargarAsistente, type AssistantBootstrapDto } from '@/app/(app)/asistente/actions';

/**
 * Botón flotante del asistente de IA (abajo-derecha en todas las páginas
 * privadas). Abre un panel lateral con el MISMO chat de /asistente
 * (componentes compartidos). Los datos se recargan en cada apertura.
 */
export function AssistantLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AssistantBootstrapDto | null>(null);
  // Versión del snapshot cargado: al llegar datos frescos remonta AssistantChat
  // (vía key) para que re-inicialice su estado con la conversación al día.
  const [dataVersion, setDataVersion] = useState(0);

  // Recarga el bootstrap CADA vez que el panel pasa de cerrado a abierto: el chat
  // persiste en el servidor y, si solo se cargara la primera vez, reabrir el
  // panel "retrocedería" la conversación a ese snapshot inicial. Mientras
  // recarga se sigue mostrando el estado anterior (sin flash de spinner);
  // el spinner solo aparece en la primera apertura (data === null).
  useEffect(() => {
    if (!open) return;
    let active = true;
    cargarAsistente()
      .then((fresh) => {
        if (!active) return;
        setData(fresh);
        setDataVersion((version) => version + 1);
      })
      .catch(() => {
        // Falla la recarga: se conserva el snapshot anterior (si lo hay);
        // en la primera apertura queda el "Cargando…" y reabrir reintenta.
      });
    return () => {
      active = false;
    };
  }, [open]);

  // En /asistente el chat ya ocupa la página: el botón sobra.
  if (pathname.startsWith('/asistente')) return null;

  return (
    <>
      {/* Botón flotante */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente IA"
          title="Asistente IA"
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface shadow-card transition-transform hover:scale-105"
        >
          <LogoMark size={30} />
        </button>
      ) : null}

      {/* Fondo + panel lateral */}
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-ink/20"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-card">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <LogoMark size={22} />
              <span className="text-sm font-semibold text-ink">Asistente IA</span>
              <div className="ml-auto flex items-center gap-1">
                <Link
                  href="/asistente"
                  onClick={() => setOpen(false)}
                  title="Abrir en página completa"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-bg hover:text-ink"
                >
                  <Maximize2 size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar asistente"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-bg hover:text-ink"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-3">
              {data === null ? (
                <p className="flex flex-1 items-center justify-center gap-2 text-sm text-ink-soft">
                  <Loader2 size={16} className="animate-spin" /> Cargando asistente…
                </p>
              ) : (
                <AssistantChat
                  key={dataVersion}
                  variant="panel"
                  patients={data.patients}
                  initialThreads={data.threads}
                  initialThread={data.latestThread}
                />
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
