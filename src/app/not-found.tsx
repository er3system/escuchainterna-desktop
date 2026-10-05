import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">EscuchaInterna</p>
        <h1 className="mt-3 text-3xl font-bold text-ink">404</h1>
        <p className="mt-2 text-sm text-ink-soft">
          No encontramos la página que buscas. Es posible que el enlace haya cambiado o que ya no
          exista.
        </p>
        <div className="mt-5">
          <Link
            href="/"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
