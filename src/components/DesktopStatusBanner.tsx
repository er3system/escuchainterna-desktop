'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Cloud, HardDrive } from 'lucide-react';

const sections: Record<string, string> = { inicio: 'Inicio', agenda: 'Agenda', pacientes: 'Pacientes', pagos: 'Pagos', mensajes: 'Mensajes', asistente: 'Asistente IA', marketing: 'Marketing', biblioteca: 'Biblioteca', configuracion: 'Configuración', ayuda: 'Ayuda', supervision: 'Supervisión', recepcion: 'Recepción' };
const pages: Record<string, string> = { apariencia: 'Apariencia', sincronizacion: 'Sincronización', integraciones: 'Servicios opcionales', perfil: 'Perfil', plantillas: 'Plantillas', consentimiento: 'Consentimiento', recordatorios: 'Recordatorios', asistentes: 'Asistentes', seguridad: 'Seguridad', nuevo: 'Nuevo', importar: 'Importar', sesiones: 'Sesiones', historia: 'Historia clínica', archivos: 'Archivos', diagnostico: 'Diagnóstico', 'mapa-familiar': 'Mapa familiar', exportar: 'Exportar', libros: 'Libros de esta PC', configuracion: 'Configuración de agendas' };

export function DesktopStatusBanner({ homeHref = '/inicio' }: { homeHref?: string }) {
  const parts = usePathname().split('/').filter(Boolean);
  const section = sections[parts[0]] ?? 'Tu consulta';
  const detail = parts.length > 1 ? pages[parts.at(-1)!] ?? (parts[0] === 'biblioteca' ? 'Lectura' : parts[0] === 'pacientes' ? 'Expediente' : 'Detalle') : null;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line pb-3 text-xs text-ink-soft">
      <nav aria-label="Ubicación" className="flex items-center gap-2 text-sm"><Link href={homeHref} className="hover:text-ink">Tu consulta</Link><ChevronRight size={14} aria-hidden="true" />{detail ? <><Link href={`/${parts[0]}`} className="hover:text-ink">{section}</Link><ChevronRight size={14} aria-hidden="true" /><span className="font-medium text-ink" aria-current="page">{detail}</span></> : <span className="font-medium text-ink" aria-current="page">{section}</span>}</nav>
      <span className="ml-auto flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1" title="Los datos de tu consulta permanecen en esta PC"><HardDrive size={12} aria-hidden="true" /> Consulta local</span>
      <Link href="/configuracion/sincronizacion" className="flex items-center gap-1.5 font-medium text-accent-strong hover:underline">
        <Cloud size={14} aria-hidden="true" /> Sincronización y continuidad
      </Link>
    </div>
  );
}
