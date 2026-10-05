'use client';

import Link from 'next/link';

import { Button } from '@/components/ui';

/** Límite de error del segmento raíz: cubre rutas públicas, auth y legales. */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">EscuchaInterna</p>
        <h1 className="mt-3 text-lg font-bold text-ink">Algo salió mal</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Ocurrió un error inesperado al cargar esta sección. Puedes reintentar; si continúa,
          escríbenos a hola@escuchainterna.com.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => reset()}>
            Reintentar
          </Button>
          <Link
            href="/"
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
