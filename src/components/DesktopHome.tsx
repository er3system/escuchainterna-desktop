import Link from 'next/link';
import { ArrowRight, CalendarDays, FileText, HardDrive, LockKeyhole, Palette } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppearanceSettings } from '@/components/appearance/AppearanceSettings';
import { PROJECT_LINKS } from '@/components/project/projectLinks';

const FEATURES = [
  { icon: CalendarDays, title: 'Todo en su lugar', text: 'Agenda, pacientes y pagos, con espacio para concentrarte.' },
  { icon: FileText, title: 'Tu memoria clínica', text: 'Historias, notas y documentos siempre a mano.' },
  { icon: LockKeyhole, title: 'Privacidad desde el inicio', text: 'Cuenta propia y contenido clínico cifrado en esta PC.' },
];

export function DesktopHome({ authenticated }: { authenticated: boolean }) {
  return (
    <main className="ei-home min-h-screen bg-bg px-6 py-8 text-ink sm:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <div className="logo-echo flex items-center gap-2"><LogoMark size={36} /><span className="font-display text-xl font-bold tracking-tight">escuchainterna<span className="text-accent-strong">.</span></span><span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-ink-soft">PARA PC</span></div>
          <ThemeToggle variant="icon" />
        </header>
        <div className="ei-route-enter grid items-center gap-12 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <section>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs font-medium text-ink-soft"><span className="h-1.5 w-1.5 rounded-full bg-accent" /><HardDrive size={13} /> Tu consulta, bajo tu control</span>
            <h1 className="mt-7 font-display text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">Un espacio para<br /><span className="text-accent-strong">escuchar mejor.</span></h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-ink-soft">Menos ruido. Más atención. Organiza tu consulta a tu ritmo, con tus datos en tu equipo y una apariencia que se adapta a ti.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={authenticated ? '/inicio' : '/registro'} className="ei-button inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-dark">{authenticated ? 'Abrir mi consulta' : 'Crear cuenta local'}<ArrowRight size={17} /></Link>
              {!authenticated ? <Link href="/login" className="ei-button rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium">Iniciar sesión</Link> : null}
            </div>
            <p className="mt-4 text-xs text-ink-soft">Sin suscripción · Funciona sin conexión · Código abierto</p>
            <Link href="/sincronizacion" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-accent-strong hover:underline">Continuar desde otra PC <ArrowRight size={14} /></Link>
          </section>
          <div className="relative">
            <div aria-hidden="true" className="ei-orbit pointer-events-none absolute -inset-8 -z-10" />
            <AppearanceSettings compact />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => <section key={title} className="ei-card flex gap-4 rounded-card border border-line bg-surface/80 p-5"><span className="ei-icon-tile"><Icon size={20} /></span><div><h2 className="text-sm font-semibold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-ink-soft">{text}</p></div></section>)}
        </div>
        <footer className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line py-5 text-xs text-ink-soft">
          <span>EscuchaInterna · Licencia MIT</span><Link href="/legal/terminos" className="hover:underline">Condiciones de uso</Link><Link href="/legal/privacidad" className="hover:underline">Privacidad local</Link>
          <a href={PROJECT_LINKS.support} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-strong hover:underline">Apoyar en Ko-fi ↗</a>
          <span className="ml-auto inline-flex items-center gap-2"><Palette size={13} /> Hecho para tu forma de trabajar</span>
        </footer>
      </div>
    </main>
  );
}
