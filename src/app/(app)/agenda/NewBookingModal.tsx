'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { CheckCircle2, Search, UserPlus, Video } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { createBookingAction, getAvailableSlotsAction } from './actions';
import type { AgendaOption, PatientOption } from './agendaTypes';
import { formatMoney } from './agendaTypes';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { FieldLabel, Modal } from './Modal';

type RecurrenceChoice = 'no_repite' | 'semanal' | 'quincenal';

export function NewBookingModal({
  agendas,
  patients,
  currency,
  defaultDate,
  defaultTime,
  onClose,
  onCreated,
  createBooking = createBookingAction,
  getSlots = getAvailableSlotsAction,
  consultorios = [],
}: {
  agendas: AgendaOption[];
  patients: PatientOption[];
  currency: string;
  defaultDate: string;
  /** Hora 'HH:mm' prellenada (p. ej. al crear desde el arrastre en el Día). */
  defaultTime?: string;
  onClose: () => void;
  onCreated: () => void;
  /**
   * Acciones inyectables (default = agenda del propio profesional). La RECEPCIÓN (§5)
   * pasa variantes acotadas al profesional destino ya validado, para reusar este mismo
   * modal sin duplicar la UI.
   */
  createBooking?: typeof createBookingAction;
  getSlots?: typeof getAvailableSlotsAction;
  /** Sedes para elegir la del a sesión (Modo Sedes, MS3); vacío = no se muestra (modo aislado). */
  consultorios?: { id: string; name: string }[];
}) {
  const activeAgendas = agendas.filter((agenda) => agenda.active);
  const [agendaId, setAgendaId] = useState(activeAgendas[0]?.id ?? '');
  const agenda = activeAgendas.find((option) => option.id === agendaId) ?? null;

  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState('');
  const [quickCreate, setQuickCreate] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickEmail, setQuickEmail] = useState('');

  const [price, setPrice] = useState<string>(agenda ? String(agenda.price) : '0');
  const [priceTouched, setPriceTouched] = useState(false);

  // Moneda efectiva de la agenda seleccionada (override de la agenda || perfil).
  const effectiveCurrency = agenda?.currency || currency;
  // «Usar otra moneda»: override puntual de ESTA reservación.
  const [useOtherCurrency, setUseOtherCurrency] = useState(false);
  const [otherCurrency, setOtherCurrency] = useState(effectiveCurrency);
  const bookingCurrency = useOtherCurrency ? otherCurrency : effectiveCurrency;
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? '');
  const [modality, setModality] = useState<'presencial' | 'virtual'>(
    agenda?.modality === 'virtual' ? 'virtual' : 'presencial',
  );
  const [recurrence, setRecurrence] = useState<RecurrenceChoice>('no_repite');
  const [repeatCount, setRepeatCount] = useState(4);
  const [patientNote, setPatientNote] = useState('');
  // Sede de la sesión (Modo Sedes, MS3): solo se ofrece si la org está en modo 'compartido'.
  const [consultorioId, setConsultorioId] = useState('');

  const [slots, setSlots] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const selectedPatient = patients.find((patient) => patient.id === patientId) ?? null;

  const filteredPatients = useMemo(() => {
    const term = patientSearch.trim().toLowerCase();
    if (!term) return patients.slice(0, 8);
    return patients
      .filter(
        (patient) =>
          patient.fullName.toLowerCase().includes(term) ||
          patient.email.toLowerCase().includes(term) ||
          patient.phone.includes(term),
      )
      .slice(0, 8);
  }, [patients, patientSearch]);

  // Precio precargado del efectivo de la agenda (editable).
  useEffect(() => {
    if (agenda && !priceTouched) setPrice(String(agenda.price));
    if (agenda && agenda.modality !== 'ambas') {
      setModality(agenda.modality === 'virtual' ? 'virtual' : 'presencial');
    }
  }, [agenda, priceTouched]);

  // Horarios disponibles del día elegido (sugerencias según disponibilidad).
  useEffect(() => {
    if (!agendaId || !date) {
      setSlots(null);
      return;
    }
    let active = true;
    setSlots(null);
    // Sugerencias best-effort: si falla la carga, el campo de hora sigue editable a mano.
    void getSlots({ agendaId, fromDate: date, days: 1 }).then((result) => {
      if (!active) return;
      setSlots(result.days[0]?.slots ?? []);
    });
    return () => {
      active = false;
    };
  }, [agendaId, date]);

  const canSubmit =
    Boolean(agendaId) &&
    Boolean(date) &&
    Boolean(time) &&
    (quickCreate ? quickName.trim().length > 0 : Boolean(patientId)) &&
    Number(price) >= 0;

  const submit = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await createBooking({
        agendaId,
        patientId: quickCreate ? undefined : patientId,
        contact: quickCreate
          ? { fullName: quickName.trim(), phone: quickPhone.trim(), email: quickEmail.trim() }
          : undefined,
        date,
        time,
        consultorioId: consultorios.length > 0 ? consultorioId || undefined : undefined,
        price: Number(price),
        // Solo se manda la moneda si difiere de la efectiva de la agenda;
        // si se omite, CreateBooking usa la efectiva (agenda || perfil).
        currency: useOtherCurrency ? otherCurrency : undefined,
        modality,
        recurrence:
          recurrence === 'no_repite' ? undefined : { frequency: recurrence, repeatCount },
        patientNote: patientNote.trim() || undefined,
      });
      if (!result.ok) {
        setError(result.error ?? 'No se pudo crear la reservación.');
        return;
      }
      setSuccess(true);
      onCreated();
    });
  };

  if (success) {
    return (
      <Modal title="Nueva reservación" onClose={onClose}>
        <div className="py-6 text-center">
          <CheckCircle2 size={48} className="mx-auto text-success" />
          <p className="mt-3 text-lg font-bold text-ink">¡Reservación creada!</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
            La confirmación por WhatsApp y correo quedó registrada en{' '}
            <Link href="/mensajes" className="font-medium text-primary hover:underline dark:text-accent-2">
              Mensajes
            </Link>
            .
          </p>
          <Button type="button" onClick={onClose} className="mt-5">
            Listo
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Nueva reservación" onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Columna paciente */}
        <div>
          <FieldLabel required>Paciente</FieldLabel>
          {quickCreate ? (
            <div className="space-y-2 rounded-card border border-line bg-bg p-3">
              <Input
                type="text"
                value={quickName}
                onChange={(event) => setQuickName(event.target.value)}
                placeholder="Nombre completo *"
              />
              <Input
                type="tel"
                value={quickPhone}
                onChange={(event) => setQuickPhone(event.target.value)}
                placeholder="Número de teléfono"
              />
              <Input
                type="email"
                value={quickEmail}
                onChange={(event) => setQuickEmail(event.target.value)}
                placeholder="nombre@ejemplo.com"
              />
              <button
                type="button"
                onClick={() => setQuickCreate(false)}
                className="text-xs font-medium text-primary hover:underline dark:text-accent-2"
              >
                ← Elegir un paciente existente
              </button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-2.5 text-ink-soft" />
                <Input
                  type="text"
                  value={patientSearch}
                  onChange={(event) => {
                    setPatientSearch(event.target.value);
                    setPatientId('');
                  }}
                  placeholder="Buscar paciente…"
                  className="pl-9"
                />
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-card border border-line">
                {filteredPatients.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-ink-soft">Sin coincidencias.</p>
                ) : (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => setPatientId(patient.id)}
                      className={`block w-full border-b border-line px-3 py-2 text-left text-sm last:border-b-0 ${
                        patientId === patient.id ? 'bg-primary-light text-primary' : 'text-ink hover:bg-bg'
                      }`}
                    >
                      <span className="block font-medium">{patient.fullName}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {patient.phone || 'Sin teléfono'} · {patient.email || 'Sin correo'}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => setQuickCreate(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline dark:text-accent-2"
              >
                <UserPlus size={13} /> Crear paciente rápido
              </button>
            </div>
          )}
        </div>

        {/* Columna sesión */}
        <div className="space-y-3">
          <label className="block">
            <FieldLabel required>Agenda (tipo de sesión)</FieldLabel>
            <Select
              value={agendaId}
              onChange={(event) => {
                setAgendaId(event.target.value);
                setPriceTouched(false);
              }}
            >
              {activeAgendas.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.durationMinutes} min
                </option>
              ))}
            </Select>
            {agenda ? (
              <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-soft">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: agenda.color }} />
                Duración {agenda.durationMinutes} min
              </span>
            ) : null}
          </label>

          {consultorios.length > 0 ? (
            <label className="block">
              <FieldLabel>Sede de la sesión</FieldLabel>
              <Select
                value={consultorioId}
                onChange={(event) => setConsultorioId(event.target.value)}
              >
                <option value="">Sin sede</option>
                {consultorios.map((consultorio) => (
                  <option key={consultorio.id} value={consultorio.id}>
                    {consultorio.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          <div>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel required>Precio ({bookingCurrency})</FieldLabel>
              {useOtherCurrency ? (
                <button
                  type="button"
                  onClick={() => setUseOtherCurrency(false)}
                  className="mb-1 text-xs font-medium text-primary hover:underline dark:text-accent-2"
                >
                  Usar la moneda de la agenda ({effectiveCurrency})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOtherCurrency(effectiveCurrency);
                    setUseOtherCurrency(true);
                  }}
                  className="mb-1 text-xs font-medium text-primary hover:underline dark:text-accent-2"
                >
                  Usar otra moneda
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  setPriceTouched(true);
                }}
                aria-label={`Precio en ${bookingCurrency}`}
              />
              {useOtherCurrency ? (
                <Select
                  value={otherCurrency}
                  onChange={(event) => setOtherCurrency(event.target.value)}
                  aria-label="Moneda de esta reservación"
                  className="w-24 shrink-0"
                >
                  {SUPPORTED_CURRENCIES.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.code}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <FieldLabel required>Fecha</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <label className="block">
              <FieldLabel required>Hora</FieldLabel>
              <Input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>
          </div>

          {slots !== null ? (
            slots.length > 0 ? (
              <div>
                <p className="mb-1 text-xs font-semibold text-ink-soft">Horarios disponibles:</p>
                <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTime(slot)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                        time === slot
                          ? 'bg-primary text-white'
                          : 'bg-primary-light text-primary hover:bg-primary hover:text-white'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-warning">
                Ese día no hay horarios dentro de tu disponibilidad; puedes elegir una hora manual.
              </p>
            )
          ) : null}

          <div>
            <FieldLabel>Modalidad</FieldLabel>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModality('presencial')}
                disabled={agenda?.modality === 'virtual'}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  modality === 'presencial'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-line bg-surface text-ink hover:bg-bg'
                }`}
              >
                📍 Presencial
              </button>
              <button
                type="button"
                onClick={() => setModality('virtual')}
                disabled={agenda?.modality === 'presencial'}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition disabled:opacity-50 ${
                  modality === 'virtual'
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-line bg-surface text-ink hover:bg-bg'
                }`}
              >
                🎥 Virtual
              </button>
            </div>
            {modality === 'virtual' ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-ink-soft">
                <Video size={12} /> Se generará una liga de videollamada automáticamente.
              </p>
            ) : null}
          </div>

          <div>
            <FieldLabel>Recurrencia</FieldLabel>
            <Select
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value as RecurrenceChoice)}
            >
              <option value="no_repite">No se repite</option>
              <option value="semanal">Cada semana</option>
              <option value="quincenal">Cada quince días</option>
            </Select>
            {recurrence !== 'no_repite' ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-ink">
                Termina después de
                <Input
                  type="number"
                  min={2}
                  max={52}
                  value={repeatCount}
                  onChange={(event) => setRepeatCount(Number(event.target.value))}
                  className="w-20"
                />
                sesiones
              </label>
            ) : null}
          </div>

          <label className="block">
            <FieldLabel>Nota / motivo (opcional)</FieldLabel>
            <Textarea
              rows={2}
              value={patientNote}
              onChange={(event) => setPatientNote(event.target.value)}
              placeholder="Ej. primera consulta, motivo de la sesión…"
            />
          </label>
        </div>
      </div>

      <div className="mt-3 min-h-5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-sm text-ink-soft">
          {agenda ? `Total: ${formatMoney(Number(price) || 0, bookingCurrency)}` : ''}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit || pending}>
            {pending ? 'Guardando…' : 'Guardar reservación'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
