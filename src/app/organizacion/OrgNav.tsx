'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Eye, Calculator, Palette, ShieldCheck, Megaphone, FolderOpen, Building2, Headset, type LucideIcon } from 'lucide-react';

const TABS: Array<{ href: string; label: string; icon: LucideIcon; exact?: boolean }> = [
  { href: '/organizacion', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/organizacion/miembros', label: 'Miembros', icon: Users },
  { href: '/organizacion/consultorios', label: 'Consultorios', icon: Building2 },
  { href: '/organizacion/recepcion', label: 'Recepción', icon: Headset },
  { href: '/organizacion/expedientes', label: 'Expedientes', icon: FolderOpen },
  { href: '/organizacion/supervision', label: 'Supervisión', icon: Eye },
  { href: '/organizacion/liquidacion', label: 'Liquidación', icon: Calculator },
  { href: '/organizacion/avisos', label: 'Avisos', icon: Megaphone },
  { href: '/organizacion/accesos', label: 'Accesos', icon: ShieldCheck },
  { href: '/organizacion/branding', label: 'Branding', icon: Palette },
];

/** El profesor solo ve la pestaña de Avisos (v3 §12: avisos a sus supervisados). */
const PROFESSOR_TABS = TABS.filter((tab) => tab.href === '/organizacion/avisos');

export function OrgNav({ viewerRole = 'org_master' }: { viewerRole?: 'org_master' | 'professor' }) {
  const pathname = usePathname();
  const tabs = viewerRole === 'professor' ? PROFESSOR_TABS : TABS;
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              active ? 'bg-primary-light text-primary' : 'text-ink-soft hover:bg-bg hover:text-ink'
            }`}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
