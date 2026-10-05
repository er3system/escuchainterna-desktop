import Link from 'next/link';
import { CalendarDays, FileText, HardDrive, LockKeyhole } from 'lucide-react';
import { LogoMark } from '@/components/Logo';

const FEATURES = [
  { icon: CalendarDays, title: 'Tu consulta organizada', text: 'Agenda, pacientes, sesiones y pagos en un solo lugar.' },
  { icon: FileText, title: 'Expedientes locales', text: 'Historias clínicas, notas y archivos guardados en esta PC.' },
  { icon: LockKeyhole, title: 'Una cuenta propia', text: 'Contraseña personal, cifrado de contenido clínico y verificación en dos pasos opcional.' },
];

export function DesktopHome({ authenticated }: { authenticated: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 py-12 text-ink">
      <div className="w-full max-w-4xl">
        <div className="mb-10 flex items-center gap-3">
          <LogoMark size={38} />
          <span className="text-xl font-bold">EscuchaInterna <span className="text-primary">para PC</span></span>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-light px-3 py-1 text-xs font-semibold text-primary">
          <HardDrive size={14} /> Tu espacio de trabajo local
        </span>
        <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">Tu consulta, en tu equipo.</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">
          Trabaja sin conexión, con tus propios datos y sin suscripción. Esta instalación empieza vacía: crea tu cuenta para preparar tu consulta.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={authenticated ? '/inicio' : '/registro'} className="rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:bg-primary-dark">
            {authenticated ? 'Abrir mi consulta' : 'Crear cuenta local'}
          </Link>
          {!authenticated ? <Link href="/login" className="rounded-lg border border-line bg-surface px-5 py-3 font-semibold hover:bg-muted">Iniciar sesión</Link> : null}
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <section key={title} className="rounded-card border border-line bg-surface p-5 shadow-card">
              <Icon size={22} className="text-primary" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-ink-soft">{text}</p>
            </section>
          ))}
        </div>
        <p className="mt-7 max-w-3xl text-sm text-ink-soft">
          Los datos no se sincronizan automáticamente con escuchainterna.com. Los servicios externos requieren conexión y configuración; los enlaces de esta instalación solo son accesibles desde esta PC. Mantén copias de seguridad de tus datos.
        </p>
        <footer className="mt-8 flex flex-wrap gap-5 border-t border-line pt-5 text-xs text-ink-soft">
          <span>Código abierto · Licencia MIT</span>
          <Link href="/legal/terminos" className="hover:underline">Condiciones de uso</Link>
          <Link href="/legal/privacidad" className="hover:underline">Privacidad local</Link>
        </footer>
      </div>
    </main>
  );
}
