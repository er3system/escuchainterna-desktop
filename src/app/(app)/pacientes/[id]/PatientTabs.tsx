'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  ClipboardList,
  ClipboardCheck,
  Stethoscope,
  Network,
  Users,
  CreditCard,
  FolderOpen,
  Printer,
  Settings,
  MessageSquare,
} from 'lucide-react';

export function PatientTabs({
  patientId,
  clinicalAccess = true,
  coverage = false,
}: {
  patientId: string;
  /** false para el rol asistente (v3 §4): solo Resumen y Pagos. */
  clinicalAccess?: boolean;
  /**
   * true = acceso de cobertura (§2.4): solo lectura del Resumen. El expediente
   * completo requiere que te asignen el paciente, así que las demás pestañas no
   * se muestran (fallan cerrado de todas formas: están acotadas al dueño).
   */
  coverage?: boolean;
}) {
  const pathname = usePathname();
  const base = `/pacientes/${patientId}`;

  const allTabs = [
    { href: base, label: 'Resumen', icon: User, exact: true, clinical: false, also: [] as string[] },
    // Expediente (fusiona Historia clínica + Sesiones): activo también al editar una sesión.
    { href: `${base}/historia`, label: 'Expediente', icon: ClipboardList, exact: false, clinical: true, also: [`${base}/sesiones`] },
    { href: `${base}/diagnostico`, label: 'Diagnóstico', icon: Stethoscope, exact: false, clinical: true, also: [] as string[] },
    { href: `${base}/cuestionarios`, label: 'Cuestionarios', icon: ClipboardCheck, exact: false, clinical: true, also: [] as string[] },
    { href: `${base}/mapa-familiar`, label: 'Mapa familiar', icon: Network, exact: false, clinical: true, also: [] as string[] },
    { href: `${base}/vinculos`, label: 'Vínculos', icon: Users, exact: false, clinical: true, also: [] as string[] },
    { href: `${base}/pagos`, label: 'Pagos', icon: CreditCard, exact: false, clinical: false, also: [] as string[] },
    // Mensajes = comunicaciones (correo) enviadas a ESTE paciente. Operativo (no clínico):
    // visible también para el asistente; oculto en cobertura/compartido (solo Resumen).
    { href: `${base}/mensajes`, label: 'Mensajes', icon: MessageSquare, exact: false, clinical: false, also: [] as string[] },
    { href: `${base}/archivos`, label: 'Archivos', icon: FolderOpen, exact: false, clinical: true, also: [] as string[] },
    { href: `${base}/exportar`, label: 'Exportar', icon: Printer, exact: false, clinical: true, also: [] as string[] },
    // Ajustes del paciente (recordatorios, compartir, eliminar): solo el tratante.
    // clinical:true ⇒ oculto al asistente y en cobertura (que solo ve el Resumen).
    { href: `${base}/ajustes`, label: 'Ajustes', icon: Settings, exact: false, clinical: true, also: [] as string[] },
  ];
  const tabs = coverage
    ? allTabs.filter((tab) => tab.exact) // cobertura: solo Resumen
    : clinicalAccess
      ? allTabs
      : allTabs.filter((tab) => !tab.clinical);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map(({ href, label, icon: Icon, exact, also }) => {
        const active = exact
          ? pathname === href
          : pathname.startsWith(href) || also.some((prefix) => pathname.startsWith(prefix));
        return (
          <Link
            key={href}
            href={href}
            className={`-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-soft hover:border-line hover:text-ink'
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
