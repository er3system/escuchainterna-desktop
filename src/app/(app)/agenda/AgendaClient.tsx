'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addDays, addMonths, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Ban,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings2,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  AgendaOption,
  AgendaView,
  CalendarBlockItem,
  CalendarBookingItem,
  PatientOption,
} from './agendaTypes';
import { BookingDetailDrawer } from './BookingDetailDrawer';
import { NewBookingModal } from './NewBookingModal';
import { BlockSlotModal } from './BlockSlotModal';
import { Modal, BTN_OUTLINE, BTN_DANGER } from './Modal';
import { deleteBlockedSlotAction } from './actions';
import { DayView, MonthView, TableView, WeekView } from './views';
import {
  AgendaSidebar,
  type SidebarNextAppointment,
  type SidebarReminder,
} from './AgendaSidebar';
import type { ReminderPatientOption } from '../notificaciones/NewReminderForm';
import type { FreeGap } from './freeSlots';

const VIEW_OPTIONS: Array<{ value: AgendaView; label: string }> = [
  { value: 'mes', label: 'Mes' },
  { value: 'semana', label: 'Semana' },
  { value: 'tabla', label: 'Tabla' },
  { value: 'dia', label: 'Día' },
];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function AgendaClient({
  view,
  anchorIso,
  bookings,
  blocks,
  agendas,
  patients,
  currency,
  gridStartHour,
  gridEndHour,
  todayIso,
  gcalConnected,
  nextAppointment,
  reminders,
  reminderPatients,
  freeSlotsToday,
  consultorios = [],
  canUseAiBriefing = true,
}: {
  view: AgendaView;
  anchorIso: string;
  bookings: CalendarBookingItem[];
  blocks: CalendarBlockItem[];
  agendas: AgendaOption[];
  patients: PatientOption[];
  currency: string;
  /** Rango horario adaptativo del grid (Semana/Día), calculado en el server. */
  gridStartHour: number;
  gridEndHour: number;
  /** "Hoy" (yyyy-MM-dd) del servidor: default de fecha de los modales, sin desajuste de hidratación. */
  todayIso: string;
  /** Columna lateral operativa: estado de Google Calendar, próxima cita y recordatorios. */
  gcalConnected: boolean;
  nextAppointment: SidebarNextAppointment | null;
  reminders: SidebarReminder[];
  reminderPatients: ReminderPatientOption[];
  freeSlotsToday: FreeGap[];
  /** Sedes para el selector de sesión (Modo Sedes, MS3); vacío si la org no es 'compartido'. */
  consultorios?: { id: string; name: string }[];
  /**
   * ¿El rol de la sesión puede usar el briefing IA del drawer? Lo calcula la
   * página (server, conoce el rol): false para assistant/recepción. Default
   * true a propósito: el guard real es el del servidor y este prop solo
   * oculta un botón que fallaría; un call-site nuevo sin dato de rol no rompe.
   */
  canUseAiBriefing?: boolean;
}) {
  const router = useRouter();
  const anchor = parseISO(anchorIso);
  const [selected, setSelected] = useState<CalendarBookingItem | null>(null);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showBlock, setShowBlock] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<CalendarBlockItem | null>(null);
  const [deleting, startDelete] = useTransition();
  // Arrastre en la rejilla del Día: rango dibujado pendiente de elegir tipo.
  const [pendingCreate, setPendingCreate] = useState<{ date: string; start: string; end: string } | null>(null);
  // Prellenado de los modales cuando se crea desde el arrastre.
  const [bookingPrefill, setBookingPrefill] = useState<{ date: string; time: string } | null>(null);
  const [blockPrefill, setBlockPrefill] = useState<{ date: string; start: string; end: string } | null>(null);

  const defaultDate = view === 'dia' ? format(anchor, 'yyyy-MM-dd') : todayIso;

  // Solapes (choques de horario): pares de reservas NO canceladas que se pisan en el
  // tiempo dentro del periodo visible. Ordenadas por inicio, dos se solapan si la
  // siguiente empieza antes de que termine la anterior.
  const conflicts = useMemo(() => {
    const active = bookings
      .filter((booking) => booking.status !== 'cancelada')
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const pairs: Array<{ a: CalendarBookingItem; b: CalendarBookingItem }> = [];
    for (let i = 0; i < active.length; i += 1) {
      for (let j = i + 1; j < active.length; j += 1) {
        if (active[j].startAt >= active[i].endAt) break; // ordenadas: ya no hay solape con i
        pairs.push({ a: active[i], b: active[j] });
      }
    }
    return pairs;
  }, [bookings]);

  // Arrastre en la rejilla (Día o Semana): guarda el rango y abre el selector.
  const handleCreateAt = (date: string, start: string, end: string) =>
    setPendingCreate({ date, start, end });

  const removeBlock = (id: string) => {
    startDelete(async () => {
      await deleteBlockedSlotAction(id);
      setSelectedBlock(null);
      router.refresh();
    });
  };

  const navigate = (nextView: AgendaView, nextAnchor: Date) => {
    router.push(`/agenda?vista=${nextView}&fecha=${format(nextAnchor, 'yyyy-MM-dd')}`);
  };

  const step = (direction: 1 | -1) => {
    if (view === 'semana') navigate(view, addDays(anchor, 7 * direction));
    else if (view === 'dia') navigate(view, addDays(anchor, direction));
    else navigate(view, addMonths(anchor, direction));
  };

  const title = (() => {
    if (view === 'semana') {
      const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
      return `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, "d MMM yyyy", { locale: es })}`;
    }
    if (view === 'dia') {
      return capitalize(format(anchor, "EEEE d 'de' MMMM yyyy", { locale: es }));
    }
    return capitalize(format(anchor, 'MMMM yyyy', { locale: es }));
  })();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-ink">Agenda</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Periodo anterior"
              className="rounded-lg border border-line bg-surface p-1.5 text-ink-soft transition hover:bg-bg hover:text-ink"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate(view, new Date())}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-bg"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Periodo siguiente"
              className="rounded-lg border border-line bg-surface p-1.5 text-ink-soft transition hover:bg-bg hover:text-ink"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <p className="text-base font-semibold text-ink">{title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-line bg-surface p-0.5">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => navigate(option.value, anchor)}
                className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  view === option.value
                    ? 'bg-primary-light text-primary'
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {option.value === 'dia' ? <Zap size={13} /> : null}
                {option.label}
              </button>
            ))}
          </div>
          <Link
            href="/agenda/configuracion"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-bg"
          >
            <Settings2 size={15} /> <span className="hidden sm:inline">Configurar agendas</span>
          </Link>
          <button
            type="button"
            onClick={() => {
              setBlockPrefill(null);
              setShowBlock(true);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-bg"
          >
            <Ban size={15} /> <span className="hidden sm:inline">Bloquear espacio</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setBookingPrefill(null);
              setShowNewBooking(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
          >
            <Plus size={15} /> Nueva reservación
          </button>
        </div>
      </div>

      {agendas.filter((agenda) => agenda.active).length === 0 ? (
        <div className="mb-4 flex items-center gap-3 rounded-card border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
          <CalendarDays size={16} />
          <span>
            Aún no tienes agendas activas.{' '}
            <Link href="/agenda/configuracion" className="font-semibold underline">
              Crea tu primera agenda
            </Link>{' '}
            para empezar a reservar sesiones.
          </span>
        </div>
      ) : null}

      {conflicts.length > 0 ? (
        <div className="mb-4 rounded-card border border-danger/40 bg-danger-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle size={16} className="shrink-0" />
            {conflicts.length === 1
              ? '1 choque de horario en este periodo'
              : `${conflicts.length} choques de horario en este periodo`}
          </p>
          <ul className="mt-1.5 space-y-0.5 text-xs text-ink">
            {conflicts.slice(0, 4).map((conflict, index) => (
              <li key={index} className="capitalize">
                {format(parseISO(conflict.a.startAt), "EEE d MMM · HH:mm", { locale: es })} —{' '}
                <span className="font-medium">{conflict.a.patientName}</span> ⨯{' '}
                <span className="font-medium">{conflict.b.patientName}</span>
              </li>
            ))}
          </ul>
          {conflicts.length > 4 ? (
            <p className="mt-1 text-xs text-ink-soft">…y {conflicts.length - 4} más.</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0">
          {view === 'mes' ? (
            <MonthView
              anchor={anchor}
              bookings={bookings}
              blocks={blocks}
              onSelect={setSelected}
              onSelectBlock={setSelectedBlock}
              onSelectDay={(day) => navigate('dia', day)}
            />
          ) : view === 'semana' ? (
            <WeekView
              anchor={anchor}
              bookings={bookings}
              blocks={blocks}
              onSelect={setSelected}
              onSelectBlock={setSelectedBlock}
              onCreateAt={handleCreateAt}
              startHour={gridStartHour}
              endHour={gridEndHour}
            />
          ) : view === 'tabla' ? (
            bookings.length === 0 ? (
              <div className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
                <p className="text-base font-semibold text-ink">Sin reservaciones</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Todavía no tienes reservaciones registradas en este periodo.
                </p>
              </div>
            ) : (
              <TableView bookings={bookings} currency={currency} onSelect={setSelected} />
            )
          ) : (
            <DayView
              anchor={anchor}
              bookings={bookings}
              blocks={blocks}
              currency={currency}
              onSelect={setSelected}
              onSelectBlock={setSelectedBlock}
              onCreateAt={handleCreateAt}
              startHour={gridStartHour}
              endHour={gridEndHour}
            />
          )}
        </div>

        <AgendaSidebar
          gcalConnected={gcalConnected}
          nextAppointment={nextAppointment}
          reminders={reminders}
          reminderPatients={reminderPatients}
          freeSlotsToday={freeSlotsToday}
        />
      </div>

      {selected ? (
        <BookingDetailDrawer
          booking={selected}
          currency={currency}
          canUseAiBriefing={canUseAiBriefing}
          onClose={() => setSelected(null)}
          onChanged={() => router.refresh()}
        />
      ) : null}

      {pendingCreate ? (
        <Modal title="Crear en este horario" onClose={() => setPendingCreate(null)}>
          <p className="text-sm text-ink-soft">
            {pendingCreate.start}–{pendingCreate.end} ·{' '}
            <span className="capitalize">
              {format(parseISO(pendingCreate.date), "EEEE d 'de' MMMM", { locale: es })}
            </span>
          </p>
          <p className="mt-3 text-sm font-medium text-ink">¿Qué quieres crear aquí?</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setBookingPrefill({ date: pendingCreate.date, time: pendingCreate.start });
                setShowNewBooking(true);
                setPendingCreate(null);
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <Plus size={15} /> Reservar paciente
            </button>
            <button
              type="button"
              onClick={() => {
                setBlockPrefill({ ...pendingCreate });
                setShowBlock(true);
                setPendingCreate(null);
              }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm font-medium text-ink transition hover:bg-bg"
            >
              <Ban size={15} /> Bloquear espacio
            </button>
          </div>
        </Modal>
      ) : null}

      {showNewBooking ? (
        <NewBookingModal
          agendas={agendas}
          patients={patients}
          currency={currency}
          consultorios={consultorios}
          defaultDate={bookingPrefill?.date ?? defaultDate}
          defaultTime={bookingPrefill?.time}
          onClose={() => {
            setShowNewBooking(false);
            setBookingPrefill(null);
          }}
          onCreated={() => router.refresh()}
        />
      ) : null}

      {showBlock ? (
        <BlockSlotModal
          defaultDate={blockPrefill?.date ?? defaultDate}
          defaultStart={blockPrefill?.start}
          defaultEnd={blockPrefill?.end}
          onClose={() => {
            setShowBlock(false);
            setBlockPrefill(null);
          }}
          onCreated={() => router.refresh()}
        />
      ) : null}

      {selectedBlock ? (
        <Modal title="Espacio bloqueado" onClose={() => setSelectedBlock(null)}>
          <div className="space-y-4">
            <div className="rounded-card border border-line bg-bg p-4 text-sm">
              <p className="font-semibold text-ink">
                {selectedBlock.title.trim() || 'Espacio bloqueado'}
              </p>
              <p className="mt-1 capitalize text-ink-soft">
                {format(parseISO(selectedBlock.startAt), "EEEE d 'de' MMMM", { locale: es })}
              </p>
              <p className="text-ink-soft">
                {format(parseISO(selectedBlock.startAt), 'HH:mm')} –{' '}
                {format(parseISO(selectedBlock.endAt), 'HH:mm')}
              </p>
            </div>
            <p className="text-xs text-ink-soft">
              Mientras exista, este rato no se ofrece para reservar en ninguna de tus agendas.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setSelectedBlock(null)} className={BTN_OUTLINE}>
                Cerrar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => removeBlock(selectedBlock.id)}
                className={`flex items-center gap-1.5 ${BTN_DANGER}`}
              >
                <Trash2 size={15} /> {deleting ? 'Quitando…' : 'Quitar bloqueo'}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
