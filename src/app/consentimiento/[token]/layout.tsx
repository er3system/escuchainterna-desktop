import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Consentimiento informado · EscuchaInterna',
  robots: { index: false, follow: false },
};

/** Layout PÚBLICO de la página de firma (sin sidebar ni sesión), móvil-primero. */
export default function ConsentimientoPublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <p className="text-lg font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
      <footer className="pb-8 text-center text-xs text-ink-soft">
        Documento privado · si recibiste esta liga por error, ciérrala.
      </footer>
    </div>
  );
}
