'use client';

import {
  addDays,
  differenceInMinutes,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { Ban, MapPin, Video } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { CalendarBlockItem, CalendarBookingItem } from './agendaTypes';
import { BOOKING_STATUS_LABEL, PAYMENT_STATUS_LABEL, formatMoney } from './agendaTypes';

interface ViewProps {
  anchor: Date;
  bookings: CalendarBookingItem[];
  blocks: CalendarBlockItem[];
  onSelect: (booking: CalendarBookingItem) => void;
  onSelectBlock: (block: CalendarBlockItem) => void;
}

function blocksOfDay(blocks: CalendarBlockItem[], day: Date): CalendarBlockItem[] {
  return blocks
    .filter((block) => isSameDay(parseISO(block.startAt), day))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

/** Etiqueta compacta de un bloqueo: "13:00–14:00 · Almuerzo". */
function blockLabel(block: CalendarBlockItem): string {
  const range = `${format(parseISO(block.startAt), 'HH:mm')}–${format(parseISO(block.endAt), 'HH:mm')}`;
  return block.title.trim() ? `${range} · ${block.title.trim()}` : range;
}

function pillPresentation(item: CalendarBookingItem): { className: string; style: CSSProperties } {
  if (item.status === 'cancelada') {
    return {
      className: 'border border-line bg-bg text-ink-soft line-through',
      style: {},
    };
  }
  if (item.status === 'confirmada' || item.status === 'completada') {
    return {
      className: `text-white ${item.status === 'completada' ? 'opacity-70' : ''}`,
      style: { backgroundColor: item.agendaColor },
    };
  }
  if (item.status === 'inasistencia') {
    return {
      className: 'border border-warning bg-warning-soft text-warning',
      style: {},
    };
  }
  // agendada: píldora "suave" (tinte + borde + texto del color de la agenda). El color va por
  // variable CSS para que en oscuro se ACLARE (un color medio como el indigo #5B5BD6 no lee como
  // texto sobre el calendario oscuro); el tratamiento claro/oscuro vive en .agenda-soft-pill (globals).
  return {
    className: 'border agenda-soft-pill',
    style: { ['--pill' as string]: item.agendaColor } as CSSProperties,
  };
}

/** Cita COBRABLE (precio > 0), sin pagar y no cancelada: tiene pago pendiente. */
function isUnpaidBillable(item: CalendarBookingItem): boolean {
  return item.status !== 'cancelada' && item.price > 0 && item.paymentStatus === 'pendiente';
}

/**
 * Marcador de PAGO PENDIENTE para las píldoras de Día/Semana: punto «$» ámbar
 * arriba a la derecha. La píldora reserva espacio a la derecha (pr-*) cuando lo
 * lleva, así no se solapa con la hora/nombre. Mismo criterio que el total "por
 * cobrar" del pie de la vista Día.
 */
function PaymentFlag({ item }: { item: CalendarBookingItem }) {
  if (!isUnpaidBillable(item)) return null;
  return (
    <span
      className="absolute right-1 top-1 z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-[9px] font-bold leading-none text-white shadow-sm"
      title="Pago pendiente"
      aria-label="Pago pendiente"
    >
      $
    </span>
  );
}

function bookingsOfDay(bookings: CalendarBookingItem[], day: Date): CalendarBookingItem[] {
  return bookings
    .filter((booking) => isSameDay(parseISO(booking.startAt), day))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}

const WEEKDAY_HEADERS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

// ---------------------------------------------------------------- Vista Mes
export function MonthView({
  anchor,
  bookings,
  blocks,
  onSelect,
  onSelectBlock,
  onSelectDay,
}: ViewProps & { onSelectDay: (day: Date) => void }) {
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days: Date[] = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <div className="grid min-w-[40rem] grid-cols-7 border-b border-line bg-bg">
        {WEEKDAY_HEADERS.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-xs font-bold text-ink-soft">
            {label}
          </div>
        ))}
      </div>
      <div className="grid min-w-[40rem] grid-cols-7">
        {days.map((day) => {
          const inMonth = isSameMonth(day, anchor);
          const dayBookings = bookingsOfDay(bookings, day);
          const dayBlocks = blocksOfDay(blocks, day);
          const visible = dayBookings.slice(0, 3);
          const hidden = dayBookings.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              className={`min-h-28 border-b border-r border-line p-1.5 ${inMonth ? 'bg-surface' : 'bg-bg'}`}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    isToday(day)
                      ? 'bg-primary text-white'
                      : inMonth
                        ? 'text-ink'
                        : 'text-ink-soft'
                  }`}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-1">
                {dayBlocks.map((block) => (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => onSelectBlock(block)}
                    className="flex w-full items-center gap-1 truncate rounded-md border border-dashed border-line bg-bg px-1.5 py-0.5 text-left text-xs font-medium text-ink-soft"
                    title={blockLabel(block)}
                  >
                    <Ban size={11} className="shrink-0" />
                    <span className="truncate">
                      {format(parseISO(block.startAt), 'HH:mm')} {block.title.trim() || 'Bloqueado'}
                    </span>
                  </button>
                ))}
                {visible.map((booking) => {
                  const pill = pillPresentation(booking);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onSelect(booking)}
                      style={pill.style}
                      className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium ${pill.className}`}
                      title={`${format(parseISO(booking.startAt), 'HH:mm')} ${booking.patientName} · ${booking.agendaName}${
                        booking.consultorioName ? ` · ${booking.consultorioName}` : ''
                      }`}
                    >
                      {format(parseISO(booking.startAt), 'HH:mm')} {booking.patientName}
                    </button>
                  );
                })}
                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className="block w-full rounded-md px-1.5 py-0.5 text-left text-xs font-medium text-primary dark:text-accent-2 hover:bg-primary-light"
                  >
                    +{hidden} más
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- Vista Semana
const WEEK_START_HOUR = 8;
const WEEK_END_HOUR = 22;
const HOUR_HEIGHT = 56;
const WEEK_TOTAL_MINUTES = (WEEK_END_HOUR - WEEK_START_HOUR) * 60;
const WEEK_TOTAL_HEIGHT = (WEEK_END_HOUR - WEEK_START_HOUR) * HOUR_HEIGHT;

/** Minutos desde el inicio de la rejilla (`startHour`) hasta `date`. */
function minutesFromGridStart(date: Date, startHour: number = WEEK_START_HOUR): number {
  return (date.getHours() - startHour) * 60 + date.getMinutes();
}

/**
 * Reparte en columnas los eventos de un día para que los que se encimen en el
 * tiempo se muestren lado a lado en vez de uno encima de otro.
 */
interface PositionedBooking {
  booking: CalendarBookingItem;
  startMin: number;
  endMin: number;
  column: number;
  columns: number;
}

function layoutDayBookings(
  dayBookings: CalendarBookingItem[],
  startHour: number = WEEK_START_HOUR,
): PositionedBooking[] {
  const items = dayBookings
    .map((booking) => {
      const start = parseISO(booking.startAt);
      const end = parseISO(booking.endAt);
      return {
        booking,
        startMin: minutesFromGridStart(start, startHour),
        // Mínimo de 30 min de alto visual para que el evento sea legible.
        endMin: minutesFromGridStart(start, startHour) + Math.max(differenceInMinutes(end, start), 30),
      };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const positioned: PositionedBooking[] = [];
  let cluster: Array<(typeof items)[number]> = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // Asigna a cada evento del grupo la primera columna libre.
    const columnEnds: number[] = [];
    const withColumns = cluster.map((item) => {
      let column = columnEnds.findIndex((end) => end <= item.startMin);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[column] = item.endMin;
      }
      return { item, column };
    });
    const columns = columnEnds.length;
    for (const { item, column } of withColumns) {
      positioned.push({ ...item, column, columns });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of items) {
    if (item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return positioned;
}

function NowIndicator({ topPercent }: { topPercent: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
      style={{ top: `${topPercent}%` }}
    >
      <span className="-ml-1 h-2 w-2 rounded-full bg-danger" />
      <span className="h-px flex-1 bg-danger" />
    </div>
  );
}

export function WeekView({
  anchor,
  bookings,
  blocks,
  onSelect,
  onSelectBlock,
  onCreateAt,
  startHour = WEEK_START_HOUR,
  endHour = WEEK_END_HOUR,
}: ViewProps & {
  /** Arrastre terminado: fecha 'yyyy-MM-dd' y horas 'HH:mm' del espacio dibujado. */
  onCreateAt: (date: string, start: string, end: string) => void;
  /** Rango horario del grid (adaptativo a la disponibilidad del profesional). */
  startHour?: number;
  endHour?: number;
}) {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  // Rango efectivo: estos locales sombrean los defaults del módulo, así toda la
  // vista (líneas, posiciones, arrastre) usa las horas adaptativas.
  const WEEK_START_HOUR = startHour;
  const WEEK_END_HOUR = endHour;
  const WEEK_TOTAL_MINUTES = (endHour - startHour) * 60;
  const WEEK_TOTAL_HEIGHT = (endHour - startHour) * HOUR_HEIGHT;
  const hours = Array.from(
    { length: WEEK_END_HOUR - WEEK_START_HOUR + 1 },
    (_, index) => WEEK_START_HOUR + index,
  );

  const now = new Date();
  const nowMinutes = minutesFromGridStart(now, startHour);
  const nowVisible = nowMinutes >= 0 && nowMinutes <= WEEK_TOTAL_MINUTES;
  const nowPercent = (nowMinutes / WEEK_TOTAL_MINUTES) * 100;

  // Arrastrar para crear, por columna (cada columna es un día distinto).
  const [drag, setDrag] = useState<{ dayIndex: number; startMin: number; endMin: number } | null>(null);
  const yToMinFromEl = (el: HTMLElement, clientY: number): number => {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return 0;
    // Altura RENDERIZADA (robusto a zoom/escala), snap a 15 min.
    const raw = ((clientY - rect.top) / rect.height) * WEEK_TOTAL_MINUTES;
    return Math.max(0, Math.min(WEEK_TOTAL_MINUTES, Math.round(raw / 15) * 15));
  };
  const beginDrag = (dayIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const minute = yToMinFromEl(event.currentTarget, event.clientY);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // sin captura, el arrastre sigue mientras el puntero quede sobre la columna
    }
    setDrag({ dayIndex, startMin: minute, endMin: minute });
  };
  const moveDrag = (dayIndex: number, event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    const minute = yToMinFromEl(event.currentTarget, event.clientY);
    setDrag((current) => (current ? { ...current, endMin: minute } : current));
  };
  const endDrag = (dayIndex: number) => {
    if (!drag || drag.dayIndex !== dayIndex) return;
    const lo = Math.min(drag.startMin, drag.endMin);
    const hi = Math.max(drag.startMin, drag.endMin);
    setDrag(null);
    // Clic (sin arrastre real) = evento de 60 min por defecto; arrastre = rango.
    const end = hi - lo >= 15 ? hi : Math.min(lo + 60, WEEK_TOTAL_MINUTES);
    if (end > lo) onCreateAt(format(days[dayIndex], 'yyyy-MM-dd'), minutesToTime(lo, startHour), minutesToTime(end, startHour));
  };

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      {/* Cabecera de días: alineada con la rejilla (misma plantilla de columnas). */}
      <div className="grid min-w-[48rem] grid-cols-[3.5rem_repeat(7,1fr)] border-b border-line bg-bg">
        <div />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-l border-line px-2 py-2 text-center">
            <p className="text-xs font-bold uppercase text-ink-soft">
              {format(day, 'EEE', { locale: es })}
            </p>
            <p
              className={`mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold ${
                isToday(day) ? 'bg-primary text-white' : 'text-ink'
              }`}
            >
              {format(day, 'd')}
            </p>
          </div>
        ))}
      </div>

      {/* Cuerpo con scroll vertical; la rejilla mide exactamente las horas. */}
      <div className="max-h-[34rem] overflow-y-auto">
        <div
          className="grid min-w-[48rem] grid-cols-[3.5rem_repeat(7,1fr)]"
          style={{ height: WEEK_TOTAL_HEIGHT }}
        >
          {/* Columna de horas: cada etiqueta centrada sobre su línea horaria. */}
          <div className="relative">
            {hours.map((hour, index) => (
              <span
                key={hour}
                className={`absolute right-1.5 text-[11px] font-medium tabular-nums text-ink-soft ${index === 0 ? '' : '-translate-y-1/2'}`}
                style={{ top: index * HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {/* Una columna por día con sus líneas horarias y sus eventos. */}
          {days.map((day, dayIndex) => {
            const positioned = layoutDayBookings(bookingsOfDay(bookings, day), startHour);
            const dayBlocks = blocksOfDay(blocks, day);
            const today = isToday(day);
            const dgLo = drag && drag.dayIndex === dayIndex ? Math.min(drag.startMin, drag.endMin) : 0;
            const dgHi = drag && drag.dayIndex === dayIndex ? Math.max(drag.startMin, drag.endMin) : 0;
            const showGhost = drag !== null && drag.dayIndex === dayIndex && dgHi - dgLo >= 15;
            return (
              <div
                key={day.toISOString()}
                className="relative select-none border-l border-line"
                onPointerDown={(event) => beginDrag(dayIndex, event)}
                onPointerMove={(event) => moveDrag(dayIndex, event)}
                onPointerUp={() => endDrag(dayIndex)}
                onPointerCancel={() => setDrag(null)}
              >
                {/* Líneas horarias: no capturan el puntero, para poder arrastrar sobre ellas. */}
                {hours.slice(0, -1).map((hour, index) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-line"
                    style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                  />
                ))}
                {/* Línea de fin de jornada. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" />

                {/* Bloqueos: barras grises bajo las reservas (z-0). */}
                {dayBlocks.map((block) => {
                  const startMin = minutesFromGridStart(parseISO(block.startAt), startHour);
                  const endMin = minutesFromGridStart(parseISO(block.endAt), startHour);
                  const top = Math.min(Math.max((startMin / WEEK_TOTAL_MINUTES) * WEEK_TOTAL_HEIGHT, 0), WEEK_TOTAL_HEIGHT);
                  const rawHeight = ((endMin - startMin) / WEEK_TOTAL_MINUTES) * WEEK_TOTAL_HEIGHT;
                  const height = Math.max(Math.min(rawHeight, WEEK_TOTAL_HEIGHT - top) - 2, 16);
                  return (
                    <button
                      key={block.id}
                      type="button"
                      onClick={() => onSelectBlock(block)}
                      style={{ top, height, left: 2, right: 2 }}
                      className="absolute z-0 flex items-center gap-1 overflow-hidden rounded-md border border-dashed border-line bg-bg px-1.5 py-0.5 text-left text-[11px] font-medium text-ink-soft"
                      title={blockLabel(block)}
                    >
                      <Ban size={10} className="shrink-0" />
                      <span className="truncate">{block.title.trim() || 'Bloqueado'}</span>
                    </button>
                  );
                })}

                {today && nowVisible ? <NowIndicator topPercent={nowPercent} /> : null}

                {positioned.map(({ booking, startMin, endMin, column, columns }) => {
                  const top = Math.min(Math.max((startMin / WEEK_TOTAL_MINUTES) * WEEK_TOTAL_HEIGHT, 0), WEEK_TOTAL_HEIGHT);
                  const rawHeight = ((endMin - startMin) / WEEK_TOTAL_MINUTES) * WEEK_TOTAL_HEIGHT;
                  const height = Math.max(Math.min(rawHeight, WEEK_TOTAL_HEIGHT - top) - 2, 20);
                  const widthPercent = 100 / columns;
                  const pill = pillPresentation(booking);
                  const start = parseISO(booking.startAt);
                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={() => onSelect(booking)}
                      style={{
                        ...pill.style,
                        top,
                        height,
                        left: `calc(${column * widthPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                      }}
                      className={`absolute z-10 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-xs font-medium leading-tight ${pill.className}`}
                      title={`${format(start, 'HH:mm')} ${booking.patientName} · ${booking.agendaName}${
                        booking.consultorioName ? ` · ${booking.consultorioName}` : ''
                      }`}
                    >
                      <PaymentFlag item={booking} />
                      <span className={`block truncate font-semibold ${isUnpaidBillable(booking) ? 'pr-3.5' : ''}`}>
                        {format(start, 'HH:mm')}
                      </span>
                      <span className="block truncate">{booking.patientName}</span>
                      {booking.consultorioName ? (
                        <span className="block truncate opacity-70">{booking.consultorioName}</span>
                      ) : null}
                    </button>
                  );
                })}

                {/* Fantasma del arrastre en curso (solo en la columna activa). */}
                {showGhost ? (
                  <div
                    className="pointer-events-none absolute z-20 flex items-start justify-center rounded-md border border-primary dark:border-accent-2/25 bg-primary-light/70 dark:bg-primary/20 text-[10px] font-semibold text-primary dark:text-accent-2"
                    style={{
                      top: (dgLo / WEEK_TOTAL_MINUTES) * WEEK_TOTAL_HEIGHT,
                      height: ((dgHi - dgLo) / WEEK_TOTAL_MINUTES) * WEEK_TOTAL_HEIGHT,
                      left: 2,
                      right: 2,
                    }}
                  >
                    {minutesToTime(dgLo, startHour)}–{minutesToTime(dgHi, startHour)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Vista Tabla
export function TableView({
  bookings,
  currency,
  onSelect,
}: {
  bookings: CalendarBookingItem[];
  currency: string;
  onSelect: (booking: CalendarBookingItem) => void;
}) {
  const sorted = [...bookings].sort((a, b) => a.startAt.localeCompare(b.startAt));
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-[56rem] text-sm">
        <thead>
          <tr className="border-b border-line bg-bg text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Hora</th>
            <th className="px-4 py-3">Paciente</th>
            <th className="px-4 py-3">Agenda</th>
            <th className="px-4 py-3">Precio</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Pago</th>
            <th className="px-4 py-3">Modalidad</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((booking, index) => {
            const start = parseISO(booking.startAt);
            return (
              <tr
                key={booking.id}
                className={`border-b border-line last:border-b-0 ${index % 2 === 1 ? 'bg-bg/60' : ''}`}
              >
                <td className="px-4 py-3 text-ink">
                  {format(start, "EEE d 'de' MMM yyyy", { locale: es })}
                </td>
                <td className="px-4 py-3 text-ink">{format(start, 'HH:mm')}</td>
                <td className="px-4 py-3 font-medium text-ink">{booking.patientName}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: booking.agendaColor }}
                    />
                    {booking.agendaName}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">
                  {formatMoney(booking.price, booking.currency || currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-sm font-medium ${
                      booking.paymentStatus === 'pagada' ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {PAYMENT_STATUS_LABEL[booking.paymentStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink">
                  <span className="inline-flex items-center gap-1.5">
                    {booking.modality === 'virtual' ? <Video size={14} /> : <MapPin size={14} />}
                    {booking.modality === 'virtual' ? 'Virtual' : 'Presencial'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onSelect(booking)}
                    className="rounded-lg bg-primary-light px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'confirmada' || status === 'completada'
      ? 'bg-success-soft text-success'
      : status === 'cancelada'
        ? 'bg-danger-soft text-danger'
        : status === 'inasistencia'
          ? 'bg-warning-soft text-warning'
          : 'bg-primary-light text-primary';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {BOOKING_STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ------------------------------------------------- Vista Día (rejilla horaria)
const DAY_HOUR_HEIGHT = 48;
const DAY_TOTAL_HEIGHT = (WEEK_END_HOUR - WEEK_START_HOUR) * DAY_HOUR_HEIGHT;

/** Minutos desde el inicio de la rejilla (`startHour`) → 'HH:mm'. */
function minutesToTime(minFromStart: number, startHour: number = WEEK_START_HOUR): string {
  const total = startHour * 60 + minFromStart;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Vista Día como rejilla horaria (estilo calendario): pinta reservas y bloqueos
 * en su franja y permite ARRASTRAR sobre el espacio libre para crear — luego se
 * elige paciente o bloqueo (al estilo de Google Calendar).
 */
export function DayView({
  anchor,
  bookings,
  blocks,
  currency,
  onSelect,
  onSelectBlock,
  onCreateAt,
  startHour = WEEK_START_HOUR,
  endHour = WEEK_END_HOUR,
}: ViewProps & {
  currency: string;
  /** Arrastre terminado: fecha 'yyyy-MM-dd' y horas 'HH:mm' del espacio dibujado. */
  onCreateAt: (date: string, start: string, end: string) => void;
  /** Rango horario del grid (adaptativo a la disponibilidad del profesional). */
  startHour?: number;
  endHour?: number;
}) {
  // Rango efectivo: locales que sombrean los defaults del módulo.
  const WEEK_START_HOUR = startHour;
  const WEEK_END_HOUR = endHour;
  const WEEK_TOTAL_MINUTES = (endHour - startHour) * 60;
  const DAY_TOTAL_HEIGHT = (endHour - startHour) * DAY_HOUR_HEIGHT;
  const dayBookings = bookingsOfDay(bookings, anchor);
  const dayBlocks = blocksOfDay(blocks, anchor);
  const positioned = layoutDayBookings(dayBookings, startHour);
  const pendingTotal = dayBookings
    .filter((booking) => booking.status !== 'cancelada' && booking.paymentStatus === 'pendiente')
    .reduce((sum, booking) => sum + booking.price, 0);

  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ startMin: number; endMin: number } | null>(null);

  const hours = Array.from(
    { length: WEEK_END_HOUR - WEEK_START_HOUR + 1 },
    (_, index) => WEEK_START_HOUR + index,
  );
  const topPx = (min: number) => (min / WEEK_TOTAL_MINUTES) * DAY_TOTAL_HEIGHT;
  const yToMin = (clientY: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    // Se divide por la altura RENDERIZADA (no la constante) para ser correcto
    // aunque la app esté escalada por zoom o un transform del contenedor.
    const raw = ((clientY - rect.top) / rect.height) * WEEK_TOTAL_MINUTES;
    const snapped = Math.round(raw / 15) * 15; // pasos de 15 min
    return Math.max(0, Math.min(WEEK_TOTAL_MINUTES, snapped));
  };

  const today = isToday(anchor);
  const nowMinutes = minutesFromGridStart(new Date(), startHour);
  const nowVisible = today && nowMinutes >= 0 && nowMinutes <= WEEK_TOTAL_MINUTES;

  // El arrastre solo arranca sobre el fondo (no sobre una reserva/bloqueo).
  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== gridRef.current) return;
    const minute = yToMin(event.clientY);
    try {
      gridRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Algunos escenarios no permiten capturar el puntero; el arrastre sigue.
    }
    setDrag({ startMin: minute, endMin: minute });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const minute = yToMin(event.clientY);
    setDrag((current) => (current ? { ...current, endMin: minute } : current));
  };
  const endDrag = () => {
    if (!drag) return;
    const lo = Math.min(drag.startMin, drag.endMin);
    const hi = Math.max(drag.startMin, drag.endMin);
    setDrag(null);
    // Clic (sin arrastre real) = evento de 60 min por defecto; arrastre = rango.
    const end = hi - lo >= 15 ? hi : Math.min(lo + 60, WEEK_TOTAL_MINUTES);
    if (end > lo) onCreateAt(format(anchor, 'yyyy-MM-dd'), minutesToTime(lo, startHour), minutesToTime(end, startHour));
  };

  const dragLo = drag ? Math.min(drag.startMin, drag.endMin) : 0;
  const dragHi = drag ? Math.max(drag.startMin, drag.endMin) : 0;

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <p className="border-b border-line px-4 py-2 text-xs text-ink-soft">
        Toca o arrastra sobre la rejilla para crear una sesión o un bloqueo.
      </p>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[20rem] grid-cols-[3.5rem_1fr]"
          style={{ height: DAY_TOTAL_HEIGHT }}
        >
          {/* Columna de horas */}
          <div className="relative">
            {hours.map((hour, index) => (
              <span
                key={hour}
                className={`absolute right-1.5 text-[11px] font-medium tabular-nums text-ink-soft ${index === 0 ? '' : '-translate-y-1/2'}`}
                style={{ top: index * DAY_HOUR_HEIGHT }}
              >
                {String(hour).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {/* Columna del día: líneas, eventos y captura del arrastre */}
          <div
            ref={gridRef}
            className="relative touch-none select-none border-l border-line"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => setDrag(null)}
          >
            {hours.slice(0, -1).map((hour, index) => (
              <div
                key={hour}
                className="pointer-events-none absolute inset-x-0 border-t border-line"
                style={{ top: index * DAY_HOUR_HEIGHT, height: DAY_HOUR_HEIGHT }}
              />
            ))}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-line" />

            {nowVisible ? <NowIndicator topPercent={(nowMinutes / WEEK_TOTAL_MINUTES) * 100} /> : null}

            {/* Bloqueos (gris, z-0, bajo las reservas) */}
            {dayBlocks.map((block) => {
              const startMin = minutesFromGridStart(parseISO(block.startAt), startHour);
              const endMin = minutesFromGridStart(parseISO(block.endAt), startHour);
              const top = Math.min(Math.max(topPx(startMin), 0), DAY_TOTAL_HEIGHT);
              const height = Math.max(Math.min(topPx(endMin) - topPx(startMin), DAY_TOTAL_HEIGHT - top) - 2, 16);
              return (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => onSelectBlock(block)}
                  style={{ top, height, left: 4, right: 4 }}
                  className="absolute z-0 flex items-center gap-1 overflow-hidden rounded-md border border-dashed border-line bg-bg px-2 py-0.5 text-left text-xs font-medium text-ink-soft"
                  title={blockLabel(block)}
                >
                  <Ban size={12} className="shrink-0" />
                  <span className="truncate">
                    {format(parseISO(block.startAt), 'HH:mm')} {block.title.trim() || 'Bloqueado'}
                  </span>
                </button>
              );
            })}

            {/* Reservas (color de la agenda, z-10) */}
            {positioned.map(({ booking, startMin, endMin, column, columns }) => {
              const top = Math.min(Math.max(topPx(startMin), 0), DAY_TOTAL_HEIGHT);
              const height = Math.max(Math.min(topPx(endMin) - topPx(startMin), DAY_TOTAL_HEIGHT - top) - 2, 22);
              const widthPercent = 100 / columns;
              const pill = pillPresentation(booking);
              const start = parseISO(booking.startAt);
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onSelect(booking)}
                  style={{
                    ...pill.style,
                    top,
                    height,
                    left: `calc(${column * widthPercent}% + 4px)`,
                    width: `calc(${widthPercent}% - 8px)`,
                  }}
                  className={`absolute z-10 overflow-hidden rounded-md px-2 py-0.5 text-left text-xs font-medium leading-tight ${pill.className}`}
                  title={`${format(start, 'HH:mm')} ${booking.patientName} · ${booking.agendaName}${
                    booking.consultorioName ? ` · ${booking.consultorioName}` : ''
                  }`}
                >
                  <PaymentFlag item={booking} />
                  <span className={`block truncate font-semibold ${isUnpaidBillable(booking) ? 'pr-3.5' : ''}`}>
                    {format(start, 'HH:mm')} · {booking.patientName}
                  </span>
                  <span className="block truncate opacity-80">
                    {booking.agendaName}
                    {booking.consultorioName ? ` · ${booking.consultorioName}` : ''}
                  </span>
                </button>
              );
            })}

            {/* Fantasma del arrastre en curso */}
            {drag && dragHi > dragLo ? (
              <div
                className="pointer-events-none absolute z-20 flex items-start justify-center rounded-md border border-primary dark:border-accent-2/25 bg-primary-light/70 dark:bg-primary/20 px-1 py-0.5 text-[11px] font-semibold text-primary dark:text-accent-2"
                style={{ top: topPx(dragLo), height: topPx(dragHi) - topPx(dragLo), left: 4, right: 4 }}
              >
                {minutesToTime(dragLo, startHour)}–{minutesToTime(dragHi, startHour)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
        <span className="text-ink-soft">
          {dayBookings.length} {dayBookings.length === 1 ? 'sesión' : 'sesiones'}
          {dayBlocks.length > 0
            ? ` · ${dayBlocks.length} ${dayBlocks.length === 1 ? 'bloqueo' : 'bloqueos'}`
            : ''}{' '}
          · {formatMoney(pendingTotal, currency)} por cobrar
        </span>
      </div>
    </div>
  );
}
