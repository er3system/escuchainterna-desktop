'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlarmClock, CalendarClock, CalendarPlus, Clock, ExternalLink, UserRound } from 'lucide-react';
import { NewReminderForm, type ReminderPatientOption } from '../notificaciones/NewReminderForm';
import type { FreeGap } from './freeSlots';

export interface SidebarReminder {
  id: string;
  title: string;
  remindAt: string | null;
  patientName: string | null;
}

export interface SidebarNextAppointment {
  startAt: string;
  patientName: string;
  agendaName: string;
}

function whenLabel(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return format(date, "EEE d MMM · HH:mm", { locale: es });
}

/**
 * Columna lateral operativa de la Agenda: sugiere conectar Google Calendar (si
 * está desconectado), muestra la próxima cita, los recordatorios próximos y un
 * alta rápida de recordatorio (general o por paciente). Reutiliza NewReminderForm.
 */
export function AgendaSidebar({
  gcalConnected,
  calendarHref = '/configuracion/integraciones',
  canConfigureCalendar = true,
  nextAppointment,
  reminders,
  reminderPatients,
  freeSlotsToday,
}: {
  gcalConnected: boolean;
  calendarHref?: string;
  canConfigureCalendar?: boolean;
  nextAppointment: SidebarNextAppointment | null;
  reminders: SidebarReminder[];
  reminderPatients: ReminderPatientOption[];
  freeSlotsToday: FreeGap[];
}) {
  return (
    <aside className="space-y-4">
      {/* Sugerencia: conectar Google Calendar (solo si está desconectado) */}
      {canConfigureCalendar && (!gcalConnected || calendarHref === '/configuracion/google-calendar') ? (
        <div className="rounded-card border border-primary/30 bg-primary-light/30 p-4 dark:border-accent-2/25 dark:bg-primary/15">
          <div className="flex items-center gap-2">
            <CalendarPlus size={17} className="shrink-0 text-primary dark:text-accent-2" />
            <h3 className="text-sm font-bold text-ink">{gcalConnected ? 'Google Calendar conectado' : 'Conecta Google Calendar'}</h3>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Publica los horarios de tus sesiones y revisa coincidencias con tu calendario personal.
          </p>
          <Link
            href={calendarHref}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark"
          >
            <ExternalLink size={13} /> {gcalConnected ? 'Abrir sincronización' : 'Conectar'}
          </Link>
        </div>
      ) : null}

      {/* Próxima cita */}
      {nextAppointment ? (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <CalendarClock size={14} className="text-primary dark:text-accent-2" /> Tu próxima cita
          </h3>
          <p className="font-semibold text-ink">{nextAppointment.patientName}</p>
          <p className="mt-0.5 text-sm capitalize text-ink-soft">{whenLabel(nextAppointment.startAt)}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{nextAppointment.agendaName}</p>
        </div>
      ) : null}

      {/* Huecos libres de hoy */}
      {freeSlotsToday.length > 0 ? (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <Clock size={14} className="text-success" /> Huecos libres hoy
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {freeSlotsToday.map((gap) => (
              <li
                key={`${gap.from}-${gap.to}`}
                className="rounded-lg border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-medium text-success"
              >
                {gap.from}–{gap.to}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Próximos recordatorios */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
            <AlarmClock size={14} className="text-primary dark:text-accent-2" /> Próximos recordatorios
          </h3>
          <Link href="/notificaciones" className="text-xs font-medium text-primary hover:underline dark:text-accent-2">
            Ver todos
          </Link>
        </div>
        {reminders.length === 0 ? (
          <p className="text-xs text-ink-soft">Sin recordatorios próximos.</p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="rounded-lg border border-line bg-bg/40 px-2.5 py-2">
                <p className="text-sm font-medium leading-tight text-ink">{reminder.title}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] capitalize text-ink-soft">
                  <span>{whenLabel(reminder.remindAt)}</span>
                  {reminder.patientName ? (
                    <span className="inline-flex items-center gap-0.5 normal-case">
                      <UserRound size={10} /> {reminder.patientName}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Alta rápida de recordatorio (general o por paciente) */}
      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
          <AlarmClock size={14} className="text-primary dark:text-accent-2" /> Recordatorio rápido
        </h3>
        <NewReminderForm patients={reminderPatients} searchable />
      </div>
    </aside>
  );
}
