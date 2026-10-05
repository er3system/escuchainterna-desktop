'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  CreditCard,
  Megaphone,
  BookOpen,
  Settings,
  MessageCircle,
  Sparkles,
  Eye,
  Building2,
  ShieldCheck,
  Headset,
  GraduationCap,
  Menu,
  X,
  LogOut,
  Palette,
  Cloud,
  Plug,
  FileCheck2,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { NotificationsBell } from '@/components/NotificationsBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogoMark } from '@/components/Logo';
import { logoutAction } from '@/app/login/actions';
import { QuickNavigation } from '@/components/QuickNavigation';

// Tipos puros: el client component no importa valores desde módulos con
// dependencias de Node (identity), solo replica la forma que le pasa el layout.
type SidebarRole = 'admin' | 'org_master' | 'professor' | 'psychologist' | 'assistant' | 'reception';

interface SidebarOrganization {
  id: string;
  name: string;
  hasLogo: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const BASE_ITEMS: NavItem[] = [
  { href: '/inicio', label: 'Inicio', icon: LayoutDashboard },
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/pacientes', label: 'Pacientes', icon: Users },
  { href: '/pagos', label: 'Pagos', icon: CreditCard },
  { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
  { href: '/asistente', label: 'Asistente IA', icon: Sparkles },
  { href: '/marketing', label: 'Marketing', icon: Megaphone },
  { href: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
];

const SUPERVISION_ITEM: NavItem = { href: '/supervision', label: 'Supervisión', icon: Eye };
const HELP_ITEM: NavItem = { href: '/ayuda', label: 'Ayuda', icon: GraduationCap };

function navigationGroup(href: string): string {
  if (['/inicio', '/agenda', '/pacientes', '/consentimientos', '/pagos', '/recepcion'].includes(href)) return 'Consulta';
  if (['/mensajes', '/marketing'].includes(href)) return 'Comunicación';
  if (['/asistente', '/biblioteca'].includes(href)) return 'Recursos';
  if (href.startsWith('/organizacion') || ['/supervision', '/admin'].includes(href)) return 'Equipo';
  return 'Tu aplicación';
}

function itemsFor(role: SidebarRole, paymentsDisabled: boolean, isSupervisor: boolean): NavItem[] {
  // Recepción multi-consultorio (§5): agenda de VARIOS profesionales (eligiendo destino),
  // sin datos propios. Solo Recepción + biblioteca + configuración reducida.
  if (role === 'reception') {
    return [
      { href: '/recepcion', label: 'Recepción', icon: Headset },
      { href: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
      HELP_ITEM,
    ];
  }

  // Asistente (v3 §4): agenda, pacientes (contacto), pagos, mensajes,
  // biblioteca (formativa) y una configuración reducida. Sin Marketing ni IA.
  if (role === 'assistant') {
    return [
      { href: '/agenda', label: 'Agenda', icon: CalendarDays },
      { href: '/pacientes', label: 'Pacientes', icon: Users },
      ...(paymentsDisabled ? [] : [{ href: '/pagos', label: 'Pagos', icon: CreditCard }]),
      { href: '/mensajes', label: 'Mensajes', icon: MessageCircle },
      { href: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
      HELP_ITEM,
    ];
  }

  // Comunidad queda oculta en la v2 (la ruta sigue existiendo, solo no se lista).
  if (role === 'professor') {
    return [
      SUPERVISION_ITEM,
      // Avisos a sus supervisados (v3 §12): fechas de corte, entregas…
      { href: '/organizacion/avisos', label: 'Avisos', icon: Megaphone },
      { href: '/biblioteca', label: 'Biblioteca', icon: BookOpen },
      { href: '/configuracion', label: 'Configuración', icon: Settings },
      HELP_ITEM,
    ];
  }

  const items = BASE_ITEMS.filter((item) => !(paymentsDisabled && item.href === '/pagos'));
  if (isSupervisor) {
    const configIndex = items.findIndex((item) => item.href === '/configuracion');
    items.splice(configIndex < 0 ? items.length : configIndex, 0, SUPERVISION_ITEM);
  }
  if (role === 'org_master') {
    items.push({ href: '/organizacion', label: 'Mi organización', icon: Building2 });
  }
  if (role === 'admin') {
    items.push({ href: '/admin', label: 'Administración', icon: ShieldCheck });
  }
  items.push(HELP_ITEM);
  return items;
}

export function Sidebar({
  role = 'psychologist',
  paymentsDisabled = false,
  isSupervisor = false,
  organization = null,
  trialDaysLeft = null,
  unreadNotifications = null,
  initialDark = false,
  desktopEdition = false,
}: {
  role?: SidebarRole;
  paymentsDisabled?: boolean;
  isSupervisor?: boolean;
  organization?: SidebarOrganization | null;
  trialDaysLeft?: number | null;
  /** Contador inicial de la campana (v3 §12); null oculta la campana. */
  unreadNotifications?: number | null;
  /** Tema actual (de la cookie, leída en el servidor) para el interruptor claro/oscuro. */
  initialDark?: boolean;
  desktopEdition?: boolean;
}) {
  const pathname = usePathname();
  const items = itemsFor(role, paymentsDisabled, isSupervisor);
  if (desktopEdition) {
    if (!['assistant', 'reception', 'professor'].includes(role)) items.splice(items.findIndex(item => item.href === '/pacientes') + 1, 0, { href: '/consentimientos', label: 'Consentimientos', icon: FileCheck2 });
    const settingsIndex = items.findIndex(item => item.href === '/configuracion');
    items.splice(settingsIndex + 1, 0, { href: '/configuracion/sincronizacion', label: 'Sincronización', icon: Cloud });
    if (!['assistant', 'reception', 'professor'].includes(role)) items.splice(settingsIndex + 2, 0, { href: '/configuracion/integraciones', label: 'Servicios opcionales', icon: Plug });
  }
  const activeHref = items.filter(item => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const groups = desktopEdition ? [...new Set(items.map(item => navigationGroup(item.href)))].map(label => ({ label, items: items.filter(item => navigationGroup(item.href) === label) })) : [{ label: 'Tu espacio de trabajo', items }];
  const destinations = items.map(item => ({ href: item.href, label: item.label, group: navigationGroup(item.href) }));
  if (items.some(item => item.href === '/pacientes')) destinations.unshift({ href: '/pacientes/nuevo', label: 'Nuevo paciente', group: 'Acciones' });
  if (items.some(item => item.href === '/agenda')) destinations.unshift({ href: '/agenda?vista=dia', label: 'Agenda de hoy', group: 'Acciones' });
  if (desktopEdition) destinations.push({ href: '/configuracion/apariencia', label: 'Cambiar apariencia', group: 'Tu aplicación' });
  const home =
    role === 'professor'
      ? '/supervision'
      : role === 'reception'
        ? '/recepcion'
        : role === 'assistant'
          ? '/agenda'
          : '/inicio';
  // Drawer móvil (v3 §8): cerrado por defecto; se cierra al navegar.
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => { setMobile(media.matches); if (!media.matches) setOpen(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current?.querySelector<HTMLElement>('button[aria-label="Cerrar menú"]')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(menu.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled])') ?? []).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', listener);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', listener); };
  }, [open, mobile]);

  return (
    <>
      {/* Barra superior móvil con hamburguesa (<md) */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 md:hidden">
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="workspace-menu"
          className="rounded-lg p-2 text-ink-soft transition-colors hover:bg-bg hover:text-ink"
        >
          <Menu size={20} />
        </button>
        <Link href={home} className="text-lg font-bold tracking-tight text-ink">
          escucha<span className="text-primary dark:text-accent-2">interna</span>
        </Link>
        {unreadNotifications !== null ? (
          <div className="ml-auto">
            <NotificationsBell initialUnread={unreadNotifications} align="right" />
          </div>
        ) : null}
      </header>

      {/* Velo al abrir el drawer en móvil */}
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        ref={menu}
        id="workspace-menu"
        aria-label="Menú principal"
        inert={mobile && !open}
        className={`ei-sidebar fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-line bg-surface transition-transform duration-200 md:z-20 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="flex flex-col gap-1 px-6 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <Link href={home} className="logo-echo flex items-center gap-1 font-display text-lg font-bold tracking-tight text-ink">
            <LogoMark size={29} /> escucha<span className="text-accent-strong">interna</span>
          </Link>
          {/* Campana en la parte superior del sidebar (desktop); en móvil vive en la barra. */}
          {unreadNotifications !== null ? (
            <div className="hidden md:block">
              <NotificationsBell initialUnread={unreadNotifications} align="left" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="rounded-lg p-1.5 text-ink-soft transition-colors hover:bg-bg hover:text-ink md:hidden"
          >
            <X size={18} />
          </button>
        </div>
        {organization ? (
          // Branding de la institución: logo grande y nombre completo (hasta
          // dos líneas, sin truncar a una) — la org que paga debe verse.
          <div className="mt-1 flex items-center gap-2.5">
            {organization.hasLogo ? (
              // El logo lo sirve el hub de organización (data/uploads/orgs/<orgId>/).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/organizaciones/${organization.id}/logo`}
                alt={`Logo de ${organization.name}`}
                className="h-9 w-9 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                <Building2 size={18} />
              </span>
            )}
            <span
              className="line-clamp-2 text-xs font-semibold leading-snug text-ink"
              title={organization.name}
            >
              {organization.name}
            </span>
          </div>
        ) : null}
      </div>
      {desktopEdition ? <div className="px-3 pt-2"><QuickNavigation destinations={destinations} /></div> : null}
      <nav aria-label="Secciones" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {groups.map(group => {
        const links = group.items.map(({ href, label, icon: Icon }) => {
          const active = activeHref === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`ei-nav-link flex items-center gap-3 rounded-xl px-3 ${desktopEdition ? 'py-2' : 'py-2.5'} text-sm font-medium transition-colors ${
                active
                  ? 'ei-nav-active bg-primary-light text-primary'
                  : 'text-ink-soft hover:bg-bg hover:text-ink'
              }`}
            >
              <Icon className="ei-nav-icon shrink-0" size={18} strokeWidth={2} aria-hidden="true" />
              {label}
            </Link>
          );
        });
        return desktopEdition && group.label === 'Comunicación' ? <details key={group.label} data-nav-group={group.label} open={group.items.some(item => item.href === activeHref)} className="ei-nav-group group mb-2">
          <summary className="ei-option flex cursor-pointer list-none items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-ink-soft">Comunicación<ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden="true" /></summary>
          <div className="space-y-0.5">{links}</div>
        </details> : <div key={group.label} data-nav-group={group.label} className="ei-nav-group mb-2 space-y-0.5"><p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">{group.label}</p>{links}</div>;
        })}
      </nav>
      <div className="px-3 pb-1">
        <Link href="/configuracion/apariencia" className="ei-option flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft hover:bg-bg hover:text-ink"><Palette size={16} /> Apariencia</Link>
        <ThemeToggle initialDark={initialDark} />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-bg hover:text-ink"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </form>
      </div>
      <div className="border-t border-line px-6 py-2 text-xs text-ink-soft">
        {trialDaysLeft !== null ? (
          // Acceso directo a Mi suscripción desde el contador del trial (v3 §10).
          <Link
            href="/configuracion/suscripcion"
            className="mb-1 block font-medium text-warning hover:underline"
          >
            Prueba gratis: {trialDaysLeft} {trialDaysLeft === 1 ? 'día restante' : 'días restantes'}
          </Link>
        ) : null}
        {desktopEdition ? 'EscuchaInterna para PC · MIT' : 'EscuchaInterna · local'}
      </div>
      </aside>
    </>
  );
}
