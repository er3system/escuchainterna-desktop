import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="EscuchaInterna — inicio">
            <Logo />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">{children}</main>

      <footer className="border-t border-line bg-surface py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-between gap-3 px-4 text-xs text-ink-soft sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} EscuchaInterna. Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <Link href="/legal/privacidad" className="transition-colors hover:text-primary">
              Aviso de privacidad
            </Link>
            <Link href="/legal/terminos" className="transition-colors hover:text-primary">
              Términos y condiciones
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
