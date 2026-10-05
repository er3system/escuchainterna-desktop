'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';

/**
 * Sistema de notificaciones efímeras (toasts) accesible. Da feedback de confirmación a las acciones
 * que no cambian de página (guardar, activar/desactivar, copiar…), que antes ocurrían en silencio.
 *
 * a11y: la región es aria-live (polite=éxito/info, assertive=error) + role=status/alert, así el
 * lector de pantalla anuncia el mensaje sin robar el foco. Auto-cierre con pausa al pasar el cursor.
 */

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<ToastTone, { icon: typeof Check; classes: string }> = {
  success: { icon: Check, classes: 'border-success/40 bg-success-soft text-success' },
  error: { icon: TriangleAlert, classes: 'border-danger/40 bg-danger-soft text-danger' },
  info: { icon: Info, classes: 'border-line bg-surface text-ink' },
};

const AUTO_DISMISS_MS = 4500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, tone, message }]);
  }, []);

  const api = useRef<ToastApi>({
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
  });

  return (
    <ToastContext.Provider value={api.current}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const { icon: Icon, classes } = TONE_STYLES[toast.tone];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback(() => {
    timer.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
  }, [onDismiss]);

  useEffect(() => {
    arm();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [arm]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      onMouseEnter={() => timer.current && clearTimeout(timer.current)}
      onMouseLeave={arm}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-card border px-4 py-3 text-sm font-medium shadow-elev-md ${classes}`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" />
      <p className="flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Cerrar notificación"
        className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 opacity-70 transition hover:opacity-100"
      >
        <X size={15} />
      </button>
    </div>
  );
}

/** Acceso a los toasts desde cualquier componente cliente bajo el ToastProvider. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast debe usarse dentro de <ToastProvider>.');
  return api;
}
