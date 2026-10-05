import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Download,
  HardDrive,
  FileSignature,
  FileText,
  LogOut,
  Plug,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
  Palette,
  Cloud,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { getStorageUsage } from '@/shared/infrastructure/storage-billing/StorageQuotaGate';
import { listPlans } from '@/shared/infrastructure/persistence/PlanCatalog';
import { StorageUsageCard } from './StorageUsageCard';
import { logoutAction } from './actions';
import { desktopDataLocations, isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

interface SettingsLink {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

const SETTINGS_LINKS: SettingsLink[] = [
  {
    href: '/configuracion/perfil',
    icon: UserRound,
    title: 'Perfil',
    description: 'Tu nombre, foto, descripción, tarifas, disponibilidad y liga pública de reservas.',
  },
  {
    href: '/configuracion/suscripcion',
    icon: CreditCard,
    title: 'Mi suscripción',
    description:
      'Tu plan, próximo cobro, historial de pagos, comparación de planes y tu programa de referidos.',
  },
  {
    href: '/agenda/configuracion',
    icon: CalendarDays,
    title: 'Agendas',
    description: 'Tipos de sesión, disponibilidad, pagos, ubicación y opciones de reserva.',
  },
  {
    href: '/configuracion/plantillas',
    icon: FileText,
    title: 'Plantillas de historia clínica',
    description: 'Crea y edita las plantillas de formulario para la historia clínica de tus pacientes.',
  },
  {
    href: '/configuracion/consentimiento',
    icon: FileSignature,
    title: 'Consentimiento informado',
    description:
      'La plantilla que firman tus pacientes (telepsicología, confidencialidad, datos personales) con firma digital o en papel.',
  },
  {
    href: '/configuracion/recordatorios',
    icon: Bell,
    title: 'Recordatorios',
    description: 'Anticipación de los recordatorios de sesión, reglas de cancelación y recordatorios de pago.',
  },
  {
    href: '/configuracion/integraciones',
    icon: Plug,
    title: 'Integraciones',
    description:
      'Tus métodos de cobro (Stripe, PayPal, Mercado Pago) y Google Calendar. WhatsApp y correo son de plataforma.',
  },
  {
    href: '/configuracion/asistentes',
    icon: Users,
    title: 'Asistentes',
    description:
      'Cuentas de recepción para tu consulta: agenda, pagos y datos de contacto, sin acceso al expediente clínico.',
  },
  {
    href: '/configuracion/seguridad',
    icon: ShieldCheck,
    title: 'Seguridad',
    description: 'Verificación en dos pasos (TOTP) para proteger tu cuenta y tus expedientes.',
  },
];

/** Configuración reducida del rol asistente (v3 §4): solo su propia seguridad. */
const ASSISTANT_LINKS: SettingsLink[] = [
  {
    href: '/configuracion/seguridad',
    icon: ShieldCheck,
    title: 'Seguridad',
    description: 'Verificación en dos pasos (TOTP) para proteger tu cuenta.',
  },
];

/**
 * Configuración del profesor: supervisa pero NO atiende pacientes, así que
 * no ve plantillas clínicas, consentimiento, agendas, asistentes,
 * integraciones de cobro ni recordatorios de pacientes.
 */
const PROFESSOR_LINKS: SettingsLink[] = [
  {
    href: '/configuracion/perfil',
    icon: UserRound,
    title: 'Perfil',
    description: 'Tu nombre, foto, descripción y datos de contacto profesionales.',
  },
  {
    href: '/configuracion/seguridad',
    icon: ShieldCheck,
    title: 'Seguridad',
    description: 'Verificación en dos pasos (TOTP) para proteger tu cuenta.',
  },
  {
    href: '/configuracion/suscripcion',
    icon: CreditCard,
    title: 'Mi suscripción',
    description: 'Tu plan, próximo cobro, historial de pagos y tu programa de referidos.',
  },
];

export default async function ConfiguracionPage() {
  const desktopEdition = isDesktopEdition();
  const localData = desktopEdition ? desktopDataLocations() : null;
  const sessionUserId = await requireSessionUserId();
  const context = await createIdentityUseCases().getSessionContext.get(sessionUserId);
  const role = context?.role ?? 'psychologist';
  const assistantView = role === 'assistant';
  const professorView = role === 'professor';
  const links = [
    { href: '/configuracion/apariencia', icon: Palette, title: 'Apariencia', description: 'Modo día, noche o automático, paletas de color y movimiento a tu ritmo.' },
    ...(desktopEdition ? [{ href: '/configuracion/sincronizacion', icon: Cloud, title: 'Sincronización con Drive', description: 'Versiones cifradas para continuar tu consulta en otra PC.' }] : []),
    ...(assistantView ? ASSISTANT_LINKS : professorView ? PROFESSOR_LINKS : SETTINGS_LINKS),
  ]
    .filter((link) => !desktopEdition || link.href !== '/configuracion/suscripcion')
    .map((link) => desktopEdition && link.href === '/configuracion/integraciones' ? { ...link, title: 'Servicios opcionales', description: 'Activa correo o IA con tu propia clave y revisa qué requiere conexión.' } : desktopEdition && link.href === '/configuracion/perfil' ? { ...link, description: 'Tu nombre, foto, datos de contacto y tarifas de la consulta local.' } : link);

  // Guía de almacenamiento: solo para roles con cartera propia (no asistente/profesor, que
  // no suben adjuntos). Admin = sin límite. El plan resuelve la cuota (default 15 GB).
  const showStorage = !assistantView && !professorView;
  const storage = showStorage ? await getStorageUsage(sessionUserId) : null;
  const planName =
    desktopEdition ? 'Edición PC' : context?.role === 'admin'
      ? 'Plataforma'
      : ((await listPlans()).find((plan) => plan.id === context?.subscription?.plan)?.name ?? 'Profesional');

  return (
    <div>
      <PageHeader
        title="Configuración"
        subtitle={
          assistantView
            ? 'Tu cuenta de asistente: seguridad y cierre de sesión. La configuración de la consulta la administra el profesional titular.'
            : professorView
              ? 'Tu cuenta de supervisión: perfil y seguridad. Las opciones clínicas son de quienes atienden consulta.'
              : desktopEdition ? 'Tu consulta local, tus datos y la seguridad de esta instalación.' : 'Ajusta tu perfil, tus agendas y las integraciones de EscuchaInterna.'
        }
        actions={
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
            >
              <LogOut size={15} /> Cerrar sesión
            </button>
          </form>
        }
      />

      {localData ? (
        <section className="mb-6 rounded-card border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 font-semibold text-ink"><HardDrive size={18} /> EscuchaInterna para PC</h2>
          <p className="mt-2 text-sm text-ink">Cuenta local · Sin suscripción · Código abierto con licencia MIT</p>
          <p className="mt-2 text-sm text-ink-soft">Los expedientes se guardan en este equipo. Puedes conectar una carpeta de Drive para publicar y recibir versiones cifradas. Los enlaces de reserva, sesión y firma de esta instalación solo funcionan en esta PC.</p>
          <details className="mt-4 text-xs text-ink-soft"><summary className="cursor-pointer font-medium text-accent-strong">Carpetas de datos y respaldos</summary><dl className="mt-3 space-y-2">
            <div><dt className="font-semibold text-ink">Carpeta de la base de datos</dt><dd className="mt-1 break-all font-mono">{localData.databaseDirectory}</dd></div>
            <div><dt className="font-semibold text-ink">Carpeta de archivos adjuntos</dt><dd className="mt-1 break-all font-mono">{localData.uploadsDirectory}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-ink-soft">Usa el menú Archivo para crear o restaurar un respaldo cifrado completo. Conserva el archivo y su contraseña por separado: el respaldo incluye las claves necesarias para restaurar en otra PC.</p>
          <p className="mt-2 text-xs text-ink-soft">Los catálogos de libros se instalan aparte y no se incluyen en el respaldo clínico.</p></details>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Acceso destacado al hub de la organización para el perfil maestro. */}
        {role === 'org_master' ? (
          <Link
            href="/organizacion"
            className="group rounded-card border border-primary bg-primary-light p-5 shadow-card transition hover:bg-primary hover:text-white sm:col-span-2 lg:col-span-3"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-white transition group-hover:bg-white group-hover:text-primary">
                <Building2 size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-ink transition group-hover:text-white">
                  Mi organización
                </h2>
                <p className="mt-0.5 text-xs text-ink-soft transition group-hover:text-white/85">
                  El panel de tu institución: actividad del equipo, miembros, supervisión, liquidación
                  y branding.
                </p>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0 text-primary transition group-hover:translate-x-0.5 group-hover:text-white"
              />
            </div>
          </Link>
        ) : null}

        {desktopEdition ? [
          { title: 'Tu consulta', paths: ['/configuracion/perfil', '/agenda/configuracion', '/configuracion/recordatorios', '/configuracion/asistentes'] },
          { title: 'Documentación clínica', paths: ['/configuracion/plantillas', '/configuracion/consentimiento'] },
          { title: 'Tu aplicación', paths: ['/configuracion/apariencia', '/configuracion/sincronizacion', '/configuracion/integraciones', '/configuracion/seguridad'] },
        ].map(group => {
          const groupLinks = links.filter(link => group.paths.includes(link.href));
          return groupLinks.length ? <section key={group.title} className="sm:col-span-2 lg:col-span-3"><h2 className="mb-3 mt-2 font-display text-lg font-bold">{group.title}</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{groupLinks.map(link => <SettingsCard key={link.href} link={link} nested />)}</div></section> : null;
        }) : links.map(link => <SettingsCard key={link.href} link={link} />)}

        {/* Pacientes: importar / exportar (solo roles con consulta propia) */}
        {assistantView || professorView ? null : (
        <div className="rounded-card border border-line bg-surface p-5 shadow-card">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
            <Users size={18} />
          </span>
          <h2 className="mt-3 text-sm font-semibold text-ink">Pacientes</h2>
          <p className="mt-1 text-xs text-ink-soft">Importa tu cartera desde CSV o exporta tus pacientes.</p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/pacientes/importar"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary hover:text-white"
            >
              <Upload size={13} /> Importar
            </Link>
            <Link
              href="/pacientes/exportar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-bg"
            >
              <Download size={13} /> Exportar
            </Link>
          </div>
        </div>
        )}

        {showStorage && storage ? (
          <StorageUsageCard
            usedBytes={storage.usedBytes}
            limitBytes={storage.limitBytes}
            planName={planName}
            desktopEdition={desktopEdition}
          />
        ) : null}
      </div>
    </div>
  );
}

function SettingsCard({ link: { href, icon: Icon, title, description }, nested = false }: { link: SettingsLink; nested?: boolean }) {
  const Heading = nested ? 'h3' : 'h2';
  return <Link href={href} className="ei-card ei-button group rounded-card border border-line bg-surface p-5 shadow-card transition hover:border-primary"><div className="flex items-start justify-between"><span className="ei-icon-tile"><Icon size={18} /></span><ChevronRight size={16} className="text-ink-soft transition group-hover:text-primary" /></div><Heading className="mt-3 text-sm font-semibold text-ink">{title}</Heading><p className="mt-1 text-xs text-ink-soft">{description}</p></Link>;
}
