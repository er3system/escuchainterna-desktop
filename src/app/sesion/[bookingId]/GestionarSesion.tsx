'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ban, CalendarClock, CalendarDays, CheckCircle2, Info, X } from 'lucide-react';
import {
  cancelPublicSessionAction,
  getPublicSessionSlotsAction,
  reschedulePublicSessionAction,
} from './actions';

interface DaySlots {
  date: string;
  slots: string[];
}

const BTN_OUTLINE =
  'rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-bg disabled:opacity-50';

const BTN_PRIMARY =
  'rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50';

/**
 * Gestión pública de la sesión por el paciente (v3-spec §6): "Reagendar" con
 * el selector de día/horario disponibles del profesional y "Cancelar sesión"
 * con confirmación. Ambas acciones corren con actor 'paciente', por lo que la
 * ventana mínima de cancelación aplica; si está cerrada se muestra el motivo
 * de forma amable y se invita a contactar al profesional.
 */
export function GestionarSesion({
  bookingId,
  practitionerName,
  minCancellationHours,
}: {
  bookingId: string;
  practitionerName: string;
  minCancellationHours: number;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'idle' | 'reagendar' | 'cancelar'>('idle');
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [windowClosed, setWindowClosed] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Carga la disponibilidad de los próximos 14 días al abrir "Reagendar".
  useEffect(() => {
    if (mode !== 'reagendar') return;
    let active = true;
    setDays(null);
    setSelectedDate('');
    setSelectedTime('');
    getPublicSessionSlotsAction({
      bookingId,
      fromDate: format(new Date(), 'yyyy-MM-dd'),
      days: 14,
    })
      .then((result) => {
        if (!active) return;
        setDays(result.days);
        if (result.error) setError(result.error);
        const firstAvailable = result.days.find((day) => day.slots.length > 0);
        if (firstAvailable) setSelectedDate(firstAvailable.date);
      })
      .catch(() => {
        // Falla de red: sin esto "Reagendar" quedaría cargando para siempre.
        if (active) setError('No pudimos cargar la disponibilidad. Recarga la página.');
      });
    return () => {
      active = false;
    };
  }, [mode, bookingId]);

  const slotsOfSelectedDay = useMemo(
    () => days?.find((day) => day.date === selectedDate)?.slots ?? [],
    [days, selectedDate],
  );

  const openMode = (next: 'reagendar' | 'cancelar') => {
    setError(null);
    setWindowClosed(false);
    setMode(next);
  };

  const closePanel = () => {
    setMode('idle');
    setError(null);
    setWindowClosed(false);
  };

  const confirmReschedule = () => {
    if (!selectedDate || !selectedTime) return;
    setError(null);
    setWindowClosed(false);
    startTransition(async () => {
      const result = await reschedulePublicSessionAction({
        bookingId,
        date: selectedDate,
        time: selectedTime,
      });
      if (!result.ok) {
        setWindowClosed(result.windowClosed ?? false);
        setError(result.error ?? 'No se pudo reagendar la sesión. Intenta de nuevo.');
        return;
      }
      setMode('idle');
      setSuccess(
        `Tu sesión quedó reagendada para el ${format(
          parseISO(`${selectedDate}T${selectedTime}:00`),
          "EEEE d 'de' MMMM 'a las' h:mm aaaa",
          { locale: es },
        )}. Te enviamos la confirmación por WhatsApp y correo.`,
      );
      router.refresh();
    });
  };

  const confirmCancel = () => {
    setError(null);
    setWindowClosed(false);
    startTransition(async () => {
      const result = await cancelPublicSessionAction({ bookingId });
      if (!result.ok) {
        setWindowClosed(result.windowClosed ?? false);
        setError(result.error ?? 'No se pudo cancelar la sesión. Intenta de nuevo.');
        return;
      }
      setMode('idle');
      setSuccess('Tu sesión fue cancelada. Te enviamos la confirmación por WhatsApp y correo.');
      router.refresh();
    });
  };

  if (success) {
    return (
      <section className="mt-6 rounded-card border border-line bg-success-soft p-5 text-center">
        <CheckCircle2 size={32} className="mx-auto text-success" />
        <p className="mt-2 text-sm text-ink">{success}</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-sm font-bold text-ink">¿Necesitas hacer un cambio?</h2>
      {minCancellationHours > 0 ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs text-ink-soft">
          <Info size={13} className="mt-0.5 shrink-0" />
          Puedes reagendar o cancelar en línea hasta {minCancellationHours} horas antes de tu sesión.
          Después de ese plazo, contacta directamente a {practitionerName}.
        </p>
      ) : null}

      {mode === 'idle' ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => openMode('reagendar')}
            className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5`}
          >
            <CalendarClock size={15} /> Reagendar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => openMode('cancelar')}
            className={`${BTN_OUTLINE} flex items-center justify-center gap-1.5 text-danger`}
          >
            <Ban size={15} /> Cancelar sesión
          </button>
        </div>
      ) : null}

      {mode === 'reagendar' ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Elige el nuevo día y horario</p>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Cerrar"
              className="rounded p-1 text-ink-soft hover:bg-bg"
            >
              <X size={16} />
            </button>
          </div>
          {days === null ? (
            <p className="py-8 text-center text-sm text-ink-soft">Cargando disponibilidad…</p>
          ) : days.every((day) => day.slots.length === 0) ? (
            <div className="py-8 text-center">
              <CalendarDays size={32} className="mx-auto text-ink-soft" />
              <p className="mt-2 text-sm font-semibold text-ink">Sin horarios disponibles</p>
              <p className="mt-1 text-sm text-ink-soft">
                No hay espacios en los próximos 14 días. Escríbele a {practitionerName} para
                encontrar un horario.
              </p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map((day) => {
                  const date = parseISO(day.date);
                  const enabled = day.slots.length > 0;
                  const selected = selectedDate === day.date;
                  return (
                    <button
                      key={day.date}
                      type="button"
                      disabled={!enabled}
                      onClick={() => {
                        setSelectedDate(day.date);
                        setSelectedTime('');
                      }}
                      className={`min-w-16 rounded-card border px-2 py-2 text-center transition ${
                        selected
                          ? 'border-primary bg-primary text-white'
                          : enabled
                            ? 'border-line bg-surface text-ink hover:bg-bg'
                            : 'border-line bg-bg text-ink-soft opacity-50'
                      }`}
                    >
                      <span className="block text-xs capitalize">
                        {format(date, 'EEE', { locale: es })}
                      </span>
                      <span className="block text-lg font-bold">{format(date, 'd')}</span>
                      <span className="block text-xs capitalize">
                        {format(date, 'MMM', { locale: es })}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 mt-3 text-sm font-semibold text-ink">Horario</p>
              {selectedDate === '' ? (
                <p className="text-sm text-ink-soft">Elige primero un día disponible.</p>
              ) : slotsOfSelectedDay.length === 0 ? (
                <p className="text-sm text-ink-soft">Ese día no tiene horarios libres.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slotsOfSelectedDay.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                        selectedTime === slot
                          ? 'bg-primary text-white'
                          : 'bg-primary-light text-primary hover:bg-primary hover:text-white'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={closePanel} className={BTN_OUTLINE}>
                  Volver
                </button>
                <button
                  type="button"
                  disabled={pending || !selectedDate || !selectedTime}
                  onClick={confirmReschedule}
                  className={BTN_PRIMARY}
                >
                  {pending ? 'Reagendando…' : 'Confirmar nuevo horario'}
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {mode === 'cancelar' ? (
        <div className="mt-4 rounded-card border border-line bg-bg p-4">
          <p className="text-sm font-bold text-ink">¿Seguro que quieres cancelar tu sesión?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Esta acción no se puede deshacer. Avisaremos a {practitionerName} de la cancelación.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" disabled={pending} onClick={closePanel} className={BTN_OUTLINE}>
              Volver
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={confirmCancel}
              className="rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Cancelando…' : 'Sí, cancelar sesión'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {error}
          {windowClosed ? (
            <span className="block pt-1 text-xs">
              Para hacer este cambio, escríbele directamente a {practitionerName}: con gusto te
              ayudará a encontrar una alternativa.
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
