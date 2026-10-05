import Link from 'next/link';
import { Logo } from '@/components/Logo';

const PRODUCT_LINKS = [
  { href: '/#caracteristicas', label: 'Características' },
  { href: '/#precios', label: 'Precios' },
  { href: '/#recursos', label: 'Recursos' },
  { href: '/#faq', label: 'Preguntas frecuentes' },
];

const ACCOUNT_LINKS = [
  { href: '/login', label: 'Iniciar sesión' },
  { href: '/registro', label: 'Crear cuenta' },
  { href: '/recuperar', label: 'Recuperar contraseña' },
];

const LEGAL_LINKS = [
  { href: '/legal/privacidad', label: 'Aviso de privacidad' },
  { href: '/legal/terminos', label: 'Términos y condiciones' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              El todo-en-uno para potenciar tu práctica como psicólogo: agenda, expedientes, pagos,
              mensajes y asistente de IA.
            </p>
          </div>

          <div>
            <p className="text-sm font-bold text-ink">Producto</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold text-ink">Cuenta</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-bold text-ink">Legal</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:hola@escuchainterna.com"
                  className="text-sm text-ink-soft transition-colors hover:text-primary"
                >
                  hola@escuchainterna.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-7 sm:flex-row">
          <p className="text-xs text-ink-soft">
            © {new Date().getFullYear()} EscuchaInterna. Todos los derechos reservados.
          </p>
          <p className="text-xs text-ink-soft">
            Hecho para la comunidad hispanohablante de salud mental.
          </p>
        </div>
      </div>
    </footer>
  );
}
