'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  BadgeDollarSign,
  BookOpen,
  Building2,
  Calculator,
  KeyRound,
  LayoutDashboard,
  Mail,
  Megaphone,
  Plug,
  ScrollText,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';

interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ITEMS: AdminNavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cuentas', label: 'Cuentas', icon: Users },
  { href: '/admin/organizaciones', label: 'Organizaciones', icon: Building2 },
  { href: '/admin/roles', label: 'Roles y permisos', icon: KeyRound },
  { href: '/admin/planes', label: 'Planes', icon: BadgeDollarSign },
  { href: '/admin/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/admin/novedades', label: 'Novedades', icon: Megaphone },
  { href: '/admin/boletin', label: 'Boletín', icon: Mail },
  { href: '/admin/biblioteca', label: 'Biblioteca', icon: BookOpen },
  { href: '/admin/proveedores', label: 'Proveedores', icon: Plug },
  { href: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
];

/** Sidebar oscuro exclusivo del hub de administración. */
export function AdminSidebar({ adminEmail }: { adminEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-white/10 bg-ink text-white">
      <div className="px-6 pb-3 pt-5">
        <Link href="/admin" className="text-xl font-bold tracking-tight text-white">
          escucha<span className="text-primary-light">interna</span>
        </Link>
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/50">
          <ShieldCheck size={13} />
          Administración de la plataforma
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-primary text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <Link
          href="/inicio"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft size={18} strokeWidth={2} />
          Volver a mi consulta
        </Link>
        <p className="mt-2 truncate px-3 text-xs text-white/40" title={adminEmail}>
          {adminEmail}
        </p>
      </div>
    </aside>
  );
}
