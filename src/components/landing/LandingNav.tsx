'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_LINKS = [
  { href: '/#caracteristicas', id: 'caracteristicas', label: 'Características' },
  { href: '/#origen', id: 'origen', label: 'Origen' },
  { href: '/#recursos', id: 'recursos', label: 'Recursos' },
  { href: '/#precios', id: 'precios', label: 'Precios' },
];

export function LandingNav({
  isAuthenticated,
  initialDark,
}: {
  isAuthenticated: boolean;
  initialDark: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Scroll-spy: marca la sección visible (la más alta de las que intersecan).
    const sections = NAV_LINKS.map((link) => document.getElementById(link.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
    );
    sections.forEach((section) => observer.observe(section));

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 transition-all duration-300 ${
        scrolled ? 'border-line bg-surface/80 shadow-elev-sm' : 'border-transparent bg-surface/40'
      }`}
    >
      {/* Barra de progreso de lectura (scroll-driven, 0 JS; degrada a invisible). */}
      <div
        aria-hidden="true"
        className="scroll-progress absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-primary via-accent to-accent-2"
      />
      <nav
        aria-label="Navegación principal"
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6 ${
          scrolled ? 'h-14' : 'h-16'
        }`}
      >
        <Link href="/" className="shrink-0" aria-label="EscuchaInterna — inicio">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative text-sm font-medium transition-colors ${
                active === link.id ? 'text-ink' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {link.label}
              <span
                className={`absolute -bottom-1.5 left-0 h-0.5 rounded-full bg-primary dark:bg-accent-2/60 transition-all duration-300 ${
                  active === link.id ? 'w-full' : 'w-0'
                }`}
              />
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle initialDark={initialDark} variant="icon" />
          {isAuthenticated ? (
            <Link
              href="/inicio"
              className="ease-spring inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-primary-dark active:scale-[0.97]"
            >
              Ir a mi consulta
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:block"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                className="ease-spring inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-card transition-all hover:bg-primary-dark active:scale-[0.97]"
              >
                Prueba gratis 7 días
              </Link>
            </>
          )}

          <details className="relative md:hidden">
            <summary
              className="flex cursor-pointer list-none items-center rounded-lg border border-line bg-surface p-2 text-ink-soft transition-colors hover:text-ink [&::-webkit-details-marker]:hidden"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </summary>
            <div
              className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col gap-1 rounded-card border border-line bg-surface p-2 shadow-card"
              // El menú es un <details> nativo: al tocar un enlace de ancla la página solo
              // hace scroll (sin remount) y el panel quedaría abierto tapando el contenido.
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('a')) {
                  (event.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
                }
              }}
            >
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-bg dark:hover:bg-white/5 hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
              {!isAuthenticated && (
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-bg dark:hover:bg-white/5 hover:text-ink"
                >
                  Iniciar sesión
                </Link>
              )}
            </div>
          </details>
        </div>
      </nav>
    </header>
  );
}
