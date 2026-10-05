'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { Switch } from '@/components/Switch';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { BTN_OUTLINE, FieldLabel } from '../Modal';
import { WeeklyAvailabilityEditor } from './WeeklyAvailabilityEditor';
import type { DayAvailabilityPrimitives } from './WeeklyAvailabilityEditor';
import { createAgendaAction, updateAgendaAction } from './actions';

export const AGENDA_COLOR_PALETTE = [
  '#5B5BD6',
  '#2180DB',
  '#22C55E',
  '#F59E0B',
  '#E5638C',
  '#A445B2',
  '#14B8A6',
  '#EF4444',
];

const DURATION_OPTIONS = [30, 45, 50, 60, 75, 90, 120];
const INTERVAL_OPTIONS = [15, 30, 45, 60];
const MIN_HOURS_OPTIONS = [0, 1, 2, 4, 8, 12, 24, 48];
const BUFFER_OPTIONS = [0, 10, 15, 30, 45, 60];

export interface AgendaFormGlobals {
  availability: DayAvailabilityPrimitives[];
  price: number;
  paymentMode: string;
  showPrice: boolean;
  modality: string;
  address: string;
  mapsUrl: string;
  currency: string;
}

export interface AgendaFormInitial {
  id?: string;
  name: string;
  color: string;
  slug: string;
  durationMinutes: number;
  slotIntervalMinutes: number;
  minBookingHours: number;
  /** Colchón en minutos reservado tras cada sesión (notas o descanso). */
  bufferMinutes: number;
  availabilityOverride: DayAvailabilityPrimitives[] | null;
  paymentOverride: {
    price: number;
    paymentMode: string;
    showPrice: boolean;
    showStripeLink: boolean;
    /** Moneda propia de la agenda; '' = usar la del perfil. */
    currency: string;
  } | null;
  locationOverride: { modality: string; address: string; mapsUrl: string } | null;
}

function SectionToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-ink">
      <Switch checked={checked} onChange={onChange} label="Sobrescribir valores globales" />
      Sobrescribir valores globales
    </div>
  );
}

export function AgendaForm({
  initial,
  globals,
}: {
  initial: AgendaFormInitial;
  globals: AgendaFormGlobals;
}) {
  const isEdit = Boolean(initial.id);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [color, setColor] = useState(initial.color);
  const [duration, setDuration] = useState(initial.durationMinutes);
  const [interval, setInterval] = useState(initial.slotIntervalMinutes);
  const [minHours, setMinHours] = useState(initial.minBookingHours);
  const [bufferMinutes, setBufferMinutes] = useState(initial.bufferMinutes);

  const [overrideAvailability, setOverrideAvailability] = useState(
    initial.availabilityOverride !== null,
  );
  const [availability, setAvailability] = useState<DayAvailabilityPrimitives[]>(
    initial.availabilityOverride ?? globals.availability,
  );

  const [overridePayment, setOverridePayment] = useState(initial.paymentOverride !== null);
  const [price, setPrice] = useState(String(initial.paymentOverride?.price ?? globals.price));
  const [paymentMode, setPaymentMode] = useState(
    initial.paymentOverride?.paymentMode ?? globals.paymentMode,
  );
  const [showPrice, setShowPrice] = useState(initial.paymentOverride?.showPrice ?? globals.showPrice);
  const [showStripeLink, setShowStripeLink] = useState(
    initial.paymentOverride?.showStripeLink ?? false,
  );
  // '' = usar la moneda del perfil.
  const [overrideCurrency, setOverrideCurrency] = useState(initial.paymentOverride?.currency ?? '');
  const effectiveCurrency = overrideCurrency || globals.currency;

  const [overrideLocation, setOverrideLocation] = useState(initial.locationOverride !== null);
  const [modality, setModality] = useState(initial.locationOverride?.modality ?? globals.modality);
  const [address, setAddress] = useState(initial.locationOverride?.address ?? globals.address);
  const [mapsUrl, setMapsUrl] = useState(initial.locationOverride?.mapsUrl ?? globals.mapsUrl);

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const payload = {
        name,
        slug: slug.trim() || undefined,
        color,
        durationMinutes: duration,
        slotIntervalMinutes: interval,
        minBookingHours: minHours,
        bufferMinutes,
        availabilityOverride: overrideAvailability ? availability : null,
        paymentOverride: overridePayment
          ? {
              price: Number(price) || 0,
              paymentMode,
              showPrice,
              showStripeLink,
              currency: overrideCurrency,
            }
          : null,
        locationOverride: overrideLocation
          ? { modality, address, mapsUrl }
          : null,
      };
      const result = isEdit
        ? await updateAgendaAction({ ...payload, id: initial.id! })
        : await createAgendaAction(payload);
      if (result && !result.ok) {
        setError(result.error ?? 'Ocurrió un error inesperado.');
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Datos básicos */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-base font-bold text-ink">Datos de la agenda</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <FieldLabel required>Nombre</FieldLabel>
            <Input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sesión estándar"
            />
          </label>
          <div className="sm:col-span-2">
            <FieldLabel>Color</FieldLabel>
            <div className="flex gap-2">
              {AGENDA_COLOR_PALETTE.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setColor(option)}
                  aria-label={`Color ${option}`}
                  style={{ backgroundColor: option }}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:scale-110"
                >
                  {color === option ? <Check size={15} className="text-white" /> : null}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <FieldLabel>Duración de la sesión</FieldLabel>
            <Select
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option >= 60
                    ? `${Math.floor(option / 60)} h${option % 60 ? ` ${option % 60} min` : ''}`
                    : `${option} minutos`}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <FieldLabel>Intervalo entre horarios</FieldLabel>
            <Select
              value={interval}
              onChange={(event) => setInterval(Number(event.target.value))}
            >
              {INTERVAL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Cada {option} minutos
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <FieldLabel>Horas mínimas para agendar</FieldLabel>
            <Select
              value={minHours}
              onChange={(event) => setMinHours(Number(event.target.value))}
            >
              {MIN_HOURS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 0 ? 'Sin mínimo' : `${option} horas antes`}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <FieldLabel>Tiempo entre sesiones (colchón)</FieldLabel>
            <Select
              value={bufferMinutes}
              onChange={(event) => setBufferMinutes(Number(event.target.value))}
            >
              {BUFFER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 0 ? 'Sin colchón' : `${option} minutos`}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-ink-soft">
              Espacio reservado después de cada sesión para notas o descanso. Los horarios
              disponibles dejarán este margen antes de la siguiente reserva.
            </p>
          </label>
          <label className="block">
            <FieldLabel>Liga pública</FieldLabel>
            <div className="flex items-center gap-1">
              <span className="text-sm text-ink-soft">/reservar/</span>
              <Input
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="se-genera-del-nombre"
              />
            </div>
          </label>
        </div>
      </section>

      {/* Disponibilidad */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">Disponibilidad</h2>
          <SectionToggle checked={overrideAvailability} onChange={setOverrideAvailability} />
        </div>
        {overrideAvailability ? (
          <WeeklyAvailabilityEditor value={availability} onChange={setAvailability} />
        ) : (
          <div className="rounded-lg bg-bg p-3 text-sm text-ink-soft">
            Esta agenda usa tu disponibilidad global del perfil.
          </div>
        )}
      </section>

      {/* Pago */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">Pago</h2>
          <SectionToggle checked={overridePayment} onChange={setOverridePayment} />
        </div>
        {overridePayment ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel>Precio de la sesión ({effectiveCurrency})</FieldLabel>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
            </label>
            <label className="block">
              <FieldLabel>Moneda</FieldLabel>
              <Select
                value={overrideCurrency}
                onChange={(event) => setOverrideCurrency(event.target.value)}
              >
                <option value="">Usar la de mi perfil ({globals.currency})</option>
                {SUPPORTED_CURRENCIES.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} — {option.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block">
              <FieldLabel>Modo de pago</FieldLabel>
              <Select
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
              >
                <option value="manual">Manual (lo registras tú)</option>
                <option value="requerido">Requerido para reservar</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(event) => setShowPrice(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Mostrar el precio al paciente al agendar
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={showStripeLink}
                onChange={(event) => setShowStripeLink(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Mostrar liga de pago al agendar
            </label>
          </div>
        ) : (
          <div className="rounded-lg bg-bg p-3 text-sm text-ink-soft">
            Esta agenda usa la tarifa global de tu perfil.
          </div>
        )}
      </section>

      {/* Ubicación */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-ink">Ubicación</h2>
          <SectionToggle checked={overrideLocation} onChange={setOverrideLocation} />
        </div>
        {overrideLocation ? (
          <div className="grid grid-cols-1 gap-4">
            <label className="block sm:max-w-xs">
              <FieldLabel>Modalidad</FieldLabel>
              <Select
                value={modality}
                onChange={(event) => setModality(event.target.value)}
              >
                <option value="ambas">Ambas</option>
                <option value="presencial">Solo presencial</option>
                <option value="virtual">Solo virtual</option>
              </Select>
            </label>
            {modality !== 'virtual' ? (
              <>
                <label className="block">
                  <FieldLabel>Dirección del consultorio</FieldLabel>
                  <Textarea
                    rows={3}
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Ej. Calle 10 Norte 2030, edificio color vino, segundo piso"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Liga de Google Maps</FieldLabel>
                  <Input
                    type="url"
                    value={mapsUrl}
                    onChange={(event) => setMapsUrl(event.target.value)}
                    placeholder="https://maps.app.goo.gl/…"
                  />
                </label>
              </>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg bg-bg p-3 text-sm text-ink-soft">
            Esta agenda usa la modalidad y dirección globales de tu perfil.
          </div>
        )}
      </section>

      <div className="min-h-5">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/agenda/configuracion" className={BTN_OUTLINE}>
          Cancelar
        </Link>
        <Button
          type="button"
          onClick={submit}
          disabled={pending || !name.trim()}
        >
          {pending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear agenda'}
        </Button>
      </div>
    </div>
  );
}
