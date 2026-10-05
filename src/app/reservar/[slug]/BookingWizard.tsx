'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Video,
} from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { Input, Textarea } from '@/components/ui';
import { formatMoney } from '@/shared/domain/currencies';
import { getPublicSlotsAction, requestPublicBookingAction } from './actions';

export interface PublicSessionType {
  id: string;
  slug: string;
  name: string;
  color: string;
  durationMinutes: number;
  price: number;
  /** Moneda efectiva de la agenda (override de la agenda o la del perfil). */
  currency: string;
  showPrice: boolean;
  modality: 'presencial' | 'virtual' | 'ambas';
  address: string;
  mapsUrl: string;
  minBookingHours: number;
}

interface DaySlots {
  date: string;
  slots: string[];
}

const BTN_PRIMARY =
  'rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50';

const BTN_OUTLINE =
  'rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-bg';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const STEP_LABELS = ['Tipo de sesión', 'Fecha y hora', 'Tus datos', 'Confirmación'];

export function BookingWizard({
  practitioner,
  sessionTypes,
  preselectedId,
  paymentPolicies,
  freeService = false,
}: {
  practitioner: { name: string; description: string; hasPhoto: boolean };
  sessionTypes: PublicSessionType[];
  preselectedId: string | null;
  paymentPolicies: string;
  /** v3 §3 (universidades): sin precios ni botón de pago en el flujo público. */
  freeService?: boolean;
}) {
  const [typeId, setTypeId] = useState<string | null>(preselectedId);
  const [step, setStep] = useState(preselectedId ? 1 : 0);
  const [days, setDays] = useState<DaySlots[] | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  // Mes visible en el calendario del paso "Fecha y hora" (inicia en el mes de hoy).
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [modality, setModality] = useState<'presencial' | 'virtual' | ''>('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState({ dialCode: '+52', number: '' });
  const [patientNote, setPatientNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    bookingId: string;
    startAt: string;
    meetUrl: string | null;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const sessionType = sessionTypes.find((option) => option.id === typeId) ?? null;

  // Carga la disponibilidad de los próximos 14 días al elegir tipo de sesión.
  useEffect(() => {
    if (!typeId) return;
    let active = true;
    setDays(null);
    setSelectedDate('');
    setSelectedTime('');
    setCalendarMonth(startOfMonth(new Date()));
    // Carga best-effort: si falla la red, el wizard se queda en "cargando" y el
    // visitante puede reintentar cambiando de tipo de sesión.
    void getPublicSlotsAction({
      agendaId: typeId,
      fromDate: format(new Date(), 'yyyy-MM-dd'),
      days: 14,
    }).then((result) => {
      if (!active) return;
      setDays(result.days);
      const firstAvailable = result.days.find((day) => day.slots.length > 0);
      if (firstAvailable) {
        setSelectedDate(firstAvailable.date);
        setCalendarMonth(startOfMonth(parseISO(firstAvailable.date)));
      }
    });
    return () => {
      active = false;
    };
  }, [typeId]);

  const slotsOfSelectedDay = useMemo(
    () => days?.find((day) => day.date === selectedDate)?.slots ?? [],
    [days, selectedDate],
  );

  // Mapa fecha (yyyy-MM-dd) → cantidad de slots, para pintar el calendario rápido.
  const slotCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of days ?? []) map.set(day.date, day.slots.length);
    return map;
  }, [days]);

  // Hoy a medianoche, para deshabilitar días pasados sin importar la hora actual.
  const today = useMemo(() => startOfMonth(new Date()), []);
  const todayDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  // La disponibilidad solo cubre ~14 días desde hoy: el rango puede llegar al mes
  // siguiente, así que permitimos navegar como mucho un mes hacia adelante.
  const maxMonth = useMemo(() => addMonths(today, 1), [today]);
  const canGoPrevMonth = calendarMonth > today;
  const canGoNextMonth = calendarMonth < maxMonth;

  // Celdas del calendario: semana de lunes a domingo, con relleno del mes contiguo.
  const calendarCells = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  const effectiveModality: 'presencial' | 'virtual' =
    sessionType?.modality === 'ambas'
      ? modality === 'virtual'
        ? 'virtual'
        : 'presencial'
      : sessionType?.modality === 'virtual'
        ? 'virtual'
        : 'presencial';

  const canContinueData =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.number.trim().length > 0 &&
    (sessionType?.modality !== 'ambas' || modality !== '');

  const confirm = () => {
    if (!sessionType) return;
    setError(null);
    startTransition(async () => {
      const result = await requestPublicBookingAction({
        agendaSlug: sessionType.slug,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.number.trim(),
        phoneCountryCode: phone.dialCode,
        date: selectedDate,
        time: selectedTime,
        modality: sessionType.modality === 'ambas' ? effectiveModality : undefined,
        patientNote: patientNote.trim() || undefined,
      });
      if (!result.ok || !result.booking) {
        setError(result.error ?? 'No se pudo agendar la sesión. Intenta con otro horario.');
        return;
      }
      setSuccess({
        bookingId: result.booking.bookingId,
        startAt: result.booking.startAt,
        meetUrl: result.booking.meetUrl,
      });
    });
  };

  const reset = () => {
    setSuccess(null);
    setError(null);
    setSelectedTime('');
    setStep(preselectedId ? 1 : 0);
    if (typeId) {
      const current = typeId;
      setTypeId(null);
      // re-dispara la carga de slots
      setTimeout(() => setTypeId(current), 0);
    }
  };

  // ------------------------------------------------------------- Éxito
  if (success) {
    return (
      <div className="mx-auto max-w-xl rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <CheckCircle2 size={56} className="mx-auto text-success" />
        <h1 className="mt-4 text-2xl font-bold text-ink">¡Sesión agendada!</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Tu sesión con {practitioner.name} quedó registrada para el{' '}
          <strong className="text-ink">
            {format(parseISO(success.startAt), "EEEE d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
              locale: es,
            })}
          </strong>
          .
        </p>
        {effectiveModality === 'virtual' ? (
          <p className="mt-2 text-sm text-ink-soft">
            La sesión será por videollamada{success.meetUrl ? ': ' : '.'}
            {success.meetUrl ? (
              <span className="font-medium text-primary dark:text-accent-2">{success.meetUrl}</span>
            ) : null}
          </p>
        ) : sessionType?.address ? (
          <p className="mt-2 text-sm text-ink-soft">Te esperamos en: {sessionType.address}</p>
        ) : null}
        <p className="mt-3 text-sm text-ink-soft">
          Recibirás la confirmación por WhatsApp y correo.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a href={`/sesion/${success.bookingId}`} className={BTN_PRIMARY}>
            {freeService ? 'Ver mi sesión' : 'Ver mi sesión / pagar'}
          </a>
          <button type="button" onClick={reset} className={BTN_OUTLINE}>
            Agendar otra sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-center text-2xl font-bold text-ink">Agendar sesión</h1>
      <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-primary" />

      {/* Stepper */}
      <ol className="mx-auto mb-8 flex max-w-xl items-center justify-between">
        {STEP_LABELS.map((label, index) => {
          const isDone = index < step;
          const isActive = index === step;
          return (
            <li
              key={label}
              aria-current={isActive ? 'step' : undefined}
              className="flex flex-1 items-center last:flex-none"
            >
              <span className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isDone
                      ? 'bg-primary text-white'
                      : isActive
                        ? 'border-2 border-primary bg-surface text-primary dark:text-accent-2'
                        : 'bg-line text-ink-soft'
                  }`}
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span
                  className={`mt-1 text-xs sm:not-sr-only ${index === step ? '' : 'sr-only'} ${isActive ? 'font-semibold text-primary dark:text-accent-2' : 'text-ink-soft'}`}
                >
                  {label}
                </span>
              </span>
              {index < STEP_LABELS.length - 1 ? (
                <span className={`mx-2 h-0.5 flex-1 ${isDone ? 'bg-primary' : 'bg-line'}`} />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr]">
        {/* Perfil del profesional */}
        <aside className="h-fit rounded-card border border-line bg-surface p-5 text-center shadow-card">
          {practitioner.hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/api/perfil/foto"
              alt={practitioner.name}
              className="mx-auto h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-soft text-2xl font-bold text-success">
              {initialsOf(practitioner.name)}
            </span>
          )}
          <p className="mt-3 text-base font-bold text-ink">{practitioner.name}</p>
          {practitioner.description ? (
            <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{practitioner.description}</p>
          ) : null}
          {sessionType ? (
            <div className="mt-4 space-y-1.5 border-t border-line pt-3 text-left text-sm text-ink">
              <p className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sessionType.color }} />
                {sessionType.name}
              </p>
              <p className="flex items-center gap-2 text-ink-soft">
                <Clock3 size={14} /> {durationLabel(sessionType.durationMinutes)}
              </p>
              {sessionType.showPrice ? (
                <p className="flex items-center gap-2 text-ink-soft">
                  💵 {formatMoney(sessionType.price, sessionType.currency)}
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-ink-soft">
                {sessionType.modality === 'virtual' ? (
                  <>
                    <Video size={14} /> Videollamada
                  </>
                ) : sessionType.modality === 'presencial' ? (
                  <>
                    <MapPin size={14} /> Presencial
                  </>
                ) : (
                  <>
                    <MapPin size={14} /> Presencial o videollamada
                  </>
                )}
              </p>
            </div>
          ) : null}
        </aside>

        {/* Paso actual */}
        <section className="rounded-card border border-line bg-surface p-6 shadow-card">
          {step === 0 ? (
            <div>
              <h2 className="mb-4 text-lg font-bold text-ink">Elige el tipo de sesión</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sessionTypes.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setTypeId(option.id);
                      setModality('');
                    }}
                    className={`rounded-card border p-4 text-left transition ${
                      typeId === option.id
                        ? 'border-primary bg-primary-light'
                        : 'border-line bg-surface hover:bg-bg'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} />
                      <span className="font-semibold text-ink">{option.name}</span>
                    </span>
                    <span className="mt-2 block text-sm text-ink-soft">
                      <Clock3 size={13} className="mr-1 inline" />
                      {durationLabel(option.durationMinutes)}
                      {option.showPrice ? ` · ${formatMoney(option.price, option.currency)}` : ''}
                    </span>
                    <span className="mt-1 block text-xs text-ink-soft">
                      {option.modality === 'virtual'
                        ? '🎥 Videollamada'
                        : option.modality === 'presencial'
                          ? '📍 Presencial'
                          : '📍 Presencial o 🎥 videollamada'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  disabled={!typeId}
                  onClick={() => setStep(1)}
                  className={BTN_PRIMARY}
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <h2 className="mb-4 text-lg font-bold text-ink">Elige fecha y hora</h2>
              {days === null ? (
                <p className="py-10 text-center text-sm text-ink-soft">Cargando disponibilidad…</p>
              ) : days.every((day) => day.slots.length === 0) ? (
                <div className="py-10 text-center">
                  <CalendarDays size={36} className="mx-auto text-ink-soft" />
                  <p className="mt-2 text-sm font-semibold text-ink">Sin horarios disponibles</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    No hay espacios en los próximos 14 días. Escríbenos directamente para encontrar
                    un horario.
                  </p>
                </div>
              ) : (
                <div className="mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-[minmax(0,auto)_1fr]">
                  {/* Calendario tipo mes (semana de lunes a domingo) */}
                  <div className="mx-auto w-full max-w-xs">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-label="Mes anterior"
                        disabled={!canGoPrevMonth}
                        onClick={() => setCalendarMonth((month) => addMonths(month, -1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-bg disabled:opacity-40"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-semibold capitalize text-ink">
                        {format(calendarMonth, 'MMMM yyyy', { locale: es })}
                      </span>
                      <button
                        type="button"
                        aria-label="Mes siguiente"
                        disabled={!canGoNextMonth}
                        onClick={() => setCalendarMonth((month) => addMonths(month, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink transition hover:bg-bg disabled:opacity-40"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-soft">
                      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {calendarCells.map((cell) => {
                        const cellKey = format(cell, 'yyyy-MM-dd');
                        const inMonth = isSameMonth(cell, calendarMonth);
                        const slotCount = slotCountByDate.get(cellKey) ?? 0;
                        const isPast = cell < todayDate;
                        const enabled = inMonth && !isPast && slotCount > 0;
                        const selected = selectedDate === cellKey;
                        const isToday = isSameDay(cell, todayDate);
                        return (
                          <button
                            key={cellKey}
                            type="button"
                            disabled={!enabled}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedDate(cellKey);
                              setSelectedTime('');
                            }}
                            className={`flex h-9 items-center justify-center rounded-lg text-sm font-medium transition ${
                              selected
                                ? 'bg-primary text-white'
                                : enabled
                                  ? `bg-primary-light text-primary hover:bg-primary hover:text-white ${
                                      isToday ? 'ring-1 ring-primary' : ''
                                    }`
                                  : `text-ink-soft ${inMonth ? 'opacity-60' : 'opacity-30'} ${
                                      isToday ? 'ring-1 ring-primary' : ''
                                    }`
                            }`}
                          >
                            {format(cell, 'd')}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Horarios del día elegido (a la derecha en desktop, debajo en móvil) */}
                  <div className="min-w-0">
                    {selectedDate === '' ? (
                      <p className="text-sm text-ink-soft">Elige primero un día disponible.</p>
                    ) : (
                      <>
                        <p className="mb-3 text-sm font-semibold capitalize text-ink">
                          {format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
                        </p>
                        {slotsOfSelectedDay.length === 0 ? (
                          <p className="text-sm text-ink-soft">Ese día no tiene horarios libres.</p>
                        ) : (
                          <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto md:grid md:grid-cols-2 lg:grid-cols-3">
                            {slotsOfSelectedDay.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setSelectedTime(slot)}
                                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition md:text-center ${
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
                      </>
                    )}
                  </div>
                </div>
              )}
              <div className="mt-6 flex justify-between">
                {preselectedId ? (
                  <span />
                ) : (
                  <button type="button" onClick={() => setStep(0)} className={BTN_OUTLINE}>
                    ‹ Atrás
                  </button>
                )}
                <button
                  type="button"
                  disabled={!selectedDate || !selectedTime}
                  onClick={() => setStep(2)}
                  className={BTN_PRIMARY}
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="mb-4 text-lg font-bold text-ink">Tus datos</h2>
              {sessionType?.modality === 'ambas' ? (
                <div className="mb-4">
                  <p className="mb-1.5 text-sm font-semibold text-ink">
                    ¿Cómo te gustaría tener tu sesión? <span className="text-danger">*</span>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModality('presencial')}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        modality === 'presencial'
                          ? 'border-success bg-success-soft text-success'
                          : 'border-line bg-surface text-ink hover:bg-bg'
                      }`}
                    >
                      📍 Presencialmente
                    </button>
                    <button
                      type="button"
                      onClick={() => setModality('virtual')}
                      className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        modality === 'virtual'
                          ? 'border-success bg-success-soft text-success'
                          : 'border-line bg-surface text-ink hover:bg-bg'
                      }`}
                    >
                      🎥 Videollamada
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-4">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink">
                    Nombre: <span className="text-danger">*</span>
                  </span>
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Juan Pérez"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink">
                    Correo: <span className="text-danger">*</span>
                  </span>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@ejemplo.com"
                  />
                </label>
                <div>
                  <span className="mb-1 block text-sm font-semibold text-ink">
                    Celular: <span className="text-danger">*</span>
                  </span>
                  <PhoneInput
                    dialCode={phone.dialCode}
                    number={phone.number}
                    onChange={setPhone}
                    placeholder="Número de teléfono"
                    required
                  />
                  <span className="mt-1 block text-xs text-ink-soft">
                    Te enviaremos la confirmación y los recordatorios por WhatsApp.
                  </span>
                </div>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink">
                    Nota o motivo de tu consulta{' '}
                    <span className="font-normal text-ink-soft">(opcional)</span>
                  </span>
                  <Textarea
                    value={patientNote}
                    onChange={(event) => setPatientNote(event.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Cuéntale al profesional brevemente qué te gustaría trabajar"
                    className="resize-y"
                  />
                </label>
              </div>
              <div className="mt-6 flex justify-between">
                <button type="button" onClick={() => setStep(1)} className={BTN_OUTLINE}>
                  ‹ Atrás
                </button>
                <button
                  type="button"
                  disabled={!canContinueData}
                  onClick={() => setStep(3)}
                  className={BTN_PRIMARY}
                >
                  Siguiente ›
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 && sessionType ? (
            <div>
              <h2 className="mb-4 text-lg font-bold text-ink">Confirma tu sesión</h2>
              <dl className="space-y-2.5 rounded-card border border-line bg-bg p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink">Sesión:</dt>
                  <dd className="text-right text-ink">{sessionType.name}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink">Fecha:</dt>
                  <dd className="text-right capitalize text-ink">
                    {selectedDate
                      ? format(parseISO(selectedDate), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
                      : ''}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink">Hora:</dt>
                  <dd className="text-right text-ink">
                    {selectedTime} · {durationLabel(sessionType.durationMinutes)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold text-ink">Modalidad:</dt>
                  <dd className="text-right text-ink">
                    {effectiveModality === 'virtual' ? '🎥 Videollamada' : '📍 Presencial'}
                  </dd>
                </div>
                {effectiveModality === 'presencial' && sessionType.address ? (
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-ink">Ubicación:</dt>
                    <dd className="text-right text-ink">
                      {sessionType.address}
                      {sessionType.mapsUrl ? (
                        <a
                          href={sessionType.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-primary dark:text-accent-2 hover:underline"
                        >
                          Ver en Google Maps
                        </a>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {effectiveModality === 'virtual' ? (
                  <div className="flex justify-between gap-3">
                    <dt className="font-semibold text-ink">Videollamada:</dt>
                    <dd className="text-right text-ink-soft">
                      Recibirás la liga de la sesión en tu confirmación.
                    </dd>
                  </div>
                ) : null}
                {sessionType.showPrice ? (
                  <div className="flex justify-between gap-3 border-t border-line pt-2.5">
                    <dt className="font-semibold text-ink">Monto:</dt>
                    <dd className="text-right text-base font-bold text-ink">
                      {formatMoney(sessionType.price, sessionType.currency)}
                    </dd>
                  </div>
                ) : null}
                {patientNote.trim() ? (
                  <div className="border-t border-line pt-2.5">
                    <dt className="font-semibold text-ink">Tu nota:</dt>
                    <dd className="mt-1 whitespace-pre-line text-ink-soft">{patientNote.trim()}</dd>
                  </div>
                ) : null}
              </dl>

              {paymentPolicies.trim() ? (
                <div className="mt-4 rounded-card border border-line p-4">
                  <p className="mb-1 text-sm font-semibold text-ink">Políticas de pago</p>
                  <p className="whitespace-pre-line text-xs text-ink-soft">{paymentPolicies}</p>
                </div>
              ) : null}

              <div className="mt-3 min-h-5">
                {error ? <p className="text-sm text-danger">{error}</p> : null}
              </div>

              <div className="mt-3 flex justify-between">
                <button type="button" onClick={() => setStep(2)} className={BTN_OUTLINE}>
                  ‹ Atrás
                </button>
                <button type="button" disabled={pending} onClick={confirm} className={BTN_PRIMARY}>
                  {pending ? 'Agendando…' : 'Confirmar sesión'}
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      {step > 0 && !preselectedId ? (
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          className="mt-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink"
        >
          <ArrowLeft size={14} /> Regresar
        </button>
      ) : null}
    </div>
  );
}
