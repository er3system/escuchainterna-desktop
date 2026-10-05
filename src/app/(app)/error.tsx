'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';

/** Error dentro de la app autenticada: conserva el shell (sidebar) del layout (app). */
export default function AppSectionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <h1 className="text-lg font-bold text-ink">No pudimos cargar esta sección</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Ocurrió un error inesperado. Reintenta; si el problema continúa, escríbenos a
          hola@escuchainterna.com.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => reset()}>
            Reintentar
          </Button>
          <Link
            href="/inicio"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
