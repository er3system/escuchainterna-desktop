import {
  BookOpen,
  CalendarDays,
  Check,
  CreditCard,
  Home,
  MessageCircle,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';

const SIDEBAR_ITEMS = [
  { label: 'Inicio', icon: Home, active: true },
  { label: 'Agenda', icon: CalendarDays, active: false },
  { label: 'Pacientes', icon: Users, active: false },
  { label: 'Pagos', icon: Wallet, active: false },
  { label: 'Mensajes', icon: MessageCircle, active: false },
  { label: 'Asistente IA', icon: Sparkles, active: false },
  { label: 'Biblioteca', icon: BookOpen, active: false },
];

const STATS = [
  { label: 'Sesiones de hoy', value: '3', note: '+1 vs. ayer' },
  { label: 'Por cobrar', value: '$128 USD', note: '2 sesiones' },
  { label: 'Pacientes activos', value: '19', note: '2 nuevos este mes' },
];

const APPOINTMENTS = [
  { time: '10:00', name: 'Mariana López', badge: 'Confirmada', tone: 'success' as const },
  { time: '13:00', name: 'Ana Sofía Peralta', badge: 'Primera vez', tone: 'warning' as const },
];

const BADGE_TONES = {
  success: 'bg-success-soft text-success',
  primary: 'bg-primary-light text-primary',
  warning: 'bg-warning-soft text-warning',
};

const CHART_BARS = [42, 58, 38, 70, 55, 82, 64, 90];

/**
 * Mock visual del dashboard dibujado solo con CSS/divs (sin imágenes externas). Se
 * "arma" al cargar con animaciones CSS (`fill: both` → terminan SIEMPRE en el estado
 * visible, así que son robustas: sin rAF, sin JS o con error, el mock queda armado y
 * legible). NO se usa GSAP aquí a propósito: los tweens de GSAP se congelarían en su
 * estado inicial si el rAF no corre (p. ej. render offscreen) y dejarían el mock oculto.
 *
 * Rotulado "Vista de ejemplo" en la barra: las cifras ilustran una consulta de muestra,
 * no son datos agregados reales. aria-hidden: es decorativo. `@media reduce` ya neutraliza
 * estas animaciones a duración 0 (globals.css), quedando el estado final visible.
 */
export function DashboardScreen() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-3xl select-none">
      {/* Pastilla flotante: recordatorio WhatsApp. */}
      <div
        data-assemble="pill"
        className="pop-in absolute -left-3 top-14 z-10 hidden sm:block lg:-left-10"
        style={{ animationDelay: '0.9s' }}
      >
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-card">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-soft">
            <MessageCircle className="h-3.5 w-3.5 text-success" />
          </span>
          <span className="text-xs font-medium text-ink">Recordatorio enviado por WhatsApp</span>
          <Check className="h-3.5 w-3.5 text-success" />
        </div>
      </div>

      {/* Pastilla flotante: pago recibido. */}
      <div
        data-assemble="pill"
        className="pop-in absolute -right-3 bottom-16 z-10 hidden sm:block lg:-right-10"
        style={{ animationDelay: '1.1s' }}
      >
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 shadow-card">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-light">
            <CreditCard className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="text-xs font-medium text-ink">Pago recibido · $43 USD</span>
        </div>
      </div>

      {/* Ventana */}
      <div
        data-assemble="window"
        className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-12px_rgb(147_163_104/0.3)]"
      >
        {/* Barra de navegador */}
        <div className="flex items-center gap-2 border-b border-line bg-bg px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <span className="ml-3 hidden rounded-full bg-surface px-3 py-1 text-[10px] font-medium text-ink-soft sm:block">
            Vista de ejemplo · app.escuchainterna.com
          </span>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div
            data-assemble="sidebar"
            className="hidden w-44 shrink-0 flex-col border-r border-line bg-bg/70 p-3 sm:flex"
          >
            <div className="mb-3 flex items-center gap-1.5 px-2">
              <LogoMark size={18} />
              <span className="text-xs font-bold text-ink">
                escucha<span className="text-primary dark:text-accent-2">interna</span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              {SIDEBAR_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium ${
                    item.active ? 'bg-primary-light text-primary' : 'text-ink-soft'
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Contenido */}
          <div className="min-w-0 flex-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Buenos días, Dra. Valeria</p>
                <p className="text-[10px] text-ink-soft">Jueves 11 de junio · 2 sesiones restantes</p>
              </div>
              <span className="hidden h-7 w-7 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white sm:flex">
                V
              </span>
            </div>

            {/* Tarjetas de métricas */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {STATS.map((stat, index) => (
                <div
                  key={stat.label}
                  data-assemble="stat"
                  className="animate-rise rounded-lg border border-line bg-bg/60 p-2.5"
                  style={{ animationDelay: `${0.5 + index * 0.08}s` }}
                >
                  <p className="truncate text-[9px] text-ink-soft">{stat.label}</p>
                  <p className="text-sm font-bold text-ink">{stat.value}</p>
                  <p className="truncate text-[9px] font-medium text-success">{stat.note}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-2 lg:grid-cols-5">
              {/* Agenda del día */}
              <div className="rounded-lg border border-line p-2.5 lg:col-span-3">
                <p className="mb-2 text-[10px] font-semibold text-ink">Agenda de hoy</p>
                <div className="flex flex-col gap-1.5">
                  {APPOINTMENTS.map((appt, index) => (
                    <div
                      key={appt.time}
                      data-assemble="row"
                      className="animate-rise flex items-center gap-2"
                      style={{ animationDelay: `${0.72 + index * 0.08}s` }}
                    >
                      <span className="w-8 text-[10px] font-semibold text-primary dark:text-accent-2">{appt.time}</span>
                      <span className="h-5 w-5 shrink-0 rounded-full bg-primary-light text-center text-[9px] font-bold leading-5 text-primary">
                        {appt.name[0]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-ink">
                        {appt.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold ${BADGE_TONES[appt.tone]}`}
                      >
                        {appt.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini gráfica de ingresos */}
              <div className="relative rounded-lg border border-line p-2.5 lg:col-span-2">
                <p className="mb-1 text-[10px] font-semibold text-ink">Ingresos del mes</p>
                <p className="mb-2 text-sm font-bold text-ink">$1,488 USD</p>
                <div className="flex h-16 items-end gap-1">
                  {CHART_BARS.map((height, index) => (
                    <div
                      key={index}
                      data-assemble="bar"
                      style={{ height: `${height}%`, animationDelay: `${0.6 + index * 0.05}s` }}
                      className={`bar-grow flex-1 origin-bottom rounded-t ${
                        index === CHART_BARS.length - 1 ? 'bg-primary' : 'bg-primary/25'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
