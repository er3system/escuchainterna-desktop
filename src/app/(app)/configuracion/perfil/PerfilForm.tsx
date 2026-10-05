'use client';

import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import { Camera, Check, Copy, Plus, X } from 'lucide-react';
import type { PractitionerProfilePrimitives } from '@/contexts/practitioner/domain/repositories/PractitionerProfileRepository';
import { PhoneInput } from '@/components/PhoneInput';
import { imageToWebp } from '@/components/imageToWebp';
import { useToast } from '@/components/Toast';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { updateProfileAction, type PerfilFormState } from './actions';

const INITIAL: PerfilFormState = {};

// Convención de días: 0 = domingo … 6 = sábado (Date.getDay()).
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

/** Separa un teléfono guardado como «+52 2221234567» en lada y número. */
function splitInternationalPhone(value: string): { dialCode: string; number: string } {
  const text = (value ?? '').trim();
  if (text.startsWith('+')) {
    const spaceIndex = text.indexOf(' ');
    if (spaceIndex > 0) {
      return { dialCode: text.slice(0, spaceIndex), number: text.slice(spaceIndex + 1).trim() };
    }
  }
  return { dialCode: '+52', number: text };
}

interface TimeRange {
  from: string;
  to: string;
}

type WeeklyAvailability = Record<number, TimeRange[]>;

export function PerfilForm({
  profile,
  appUrl,
  basic = false,
}: {
  profile: PractitionerProfilePrimitives;
  appUrl: string;
  /**
   * Perfil básico (rol profesor: supervisa, no atiende): oculta modalidad,
   * tarifas, disponibilidad y liga pública, preservando esos valores con
   * inputs ocultos para que guardar no los borre.
   */
  basic?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(updateProfileAction, INITIAL);
  const toast = useToast();
  // Feedback de confirmación al guardar (la acción no cambia de página): toast de éxito/error.
  useEffect(() => {
    if (state.ok) toast.success(state.ok);
    else if (state.error) toast.error(state.error);
  }, [state, toast]);
  const [policies, setPolicies] = useState(profile.paymentPolicies);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [cellPhone, setCellPhone] = useState({
    dialCode: profile.phoneCountryCode || '+52',
    number: profile.phone,
  });
  const [contactPhone, setContactPhone] = useState(() => splitInternationalPhone(profile.contactPhone));
  const [noShowFeeEnabled, setNoShowFeeEnabled] = useState(profile.noShowFeeEnabled);
  const [lateCancelFeeEnabled, setLateCancelFeeEnabled] = useState(profile.lateCancelFeeEnabled);
  // Controlado para que etiquetas y símbolos de dinero cambien en vivo al elegir moneda.
  const [currency, setCurrency] = useState(profile.currency || 'MXN');
  useEffect(() => {
    setCurrency(profile.currency || 'MXN');
  }, [profile.currency]);
  const selectedCurrency =
    SUPPORTED_CURRENCIES.find((item) => item.code === currency) ?? SUPPORTED_CURRENCIES[0];
  const [availability, setAvailability] = useState<WeeklyAvailability>(() => {
    const initial: WeeklyAvailability = {};
    for (const entry of profile.availability) initial[entry.day] = entry.ranges;
    return initial;
  });

  const availabilityJson = useMemo(() => {
    const days = Object.entries(availability)
      .map(([day, ranges]) => ({ day: Number(day), ranges }))
      .filter((entry) => entry.ranges.length > 0);
    return JSON.stringify(days);
  }, [availability]);

  const publicLink = `${appUrl}/reservar/${profile.publicSlug}`;

  const initials = (profile.fullName || 'EI')
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // El portapapeles puede no estar disponible; el input permite copiar a mano.
    }
  };

  const toggleDay = (day: number) => {
    setAvailability((current) => {
      const next = { ...current };
      if (next[day] && next[day].length > 0) next[day] = [];
      else next[day] = [{ from: '09:00', to: '17:00' }];
      return next;
    });
  };

  const updateRange = (day: number, index: number, field: 'from' | 'to', value: string) => {
    setAvailability((current) => {
      const ranges = [...(current[day] ?? [])];
      ranges[index] = { ...ranges[index], [field]: value };
      return { ...current, [day]: ranges };
    });
  };

  const addRange = (day: number) => {
    setAvailability((current) => ({
      ...current,
      [day]: [...(current[day] ?? []), { from: '09:00', to: '17:00' }],
    }));
  };

  const removeRange = (day: number, index: number) => {
    setAvailability((current) => ({
      ...current,
      [day]: (current[day] ?? []).filter((_, i) => i !== index),
    }));
  };

  return (
    <form
      action={dispatch}
      onSubmit={(event) => {
        const formData = new FormData(event.currentTarget);
        submitFormWithoutNativeReset(event, () => {
          startTransition(() => dispatch(formData));
        });
      }}
      className="max-w-3xl space-y-6"
    >
      <input type="hidden" name="disponibilidad" value={availabilityJson} />
      {basic ? (
        <>
          {/* Perfil básico: estos campos no se muestran, pero guardar no debe borrarlos. */}
          <input type="hidden" name="maps_url" value={profile.mapsUrl} />
          <input type="hidden" name="direccion" value={profile.address} />
          <input type="hidden" name="politicas" value={profile.paymentPolicies} />
          {profile.showPrice ? <input type="hidden" name="mostrar_precio" value="1" /> : null}
          {profile.noShowFeeEnabled ? (
            <input type="hidden" name="tarifa_inasistencia_activa" value="1" />
          ) : null}
          {profile.lateCancelFeeEnabled ? (
            <input type="hidden" name="tarifa_cancelacion_activa" value="1" />
          ) : null}
        </>
      ) : null}

      {/* Datos personales */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-bold text-ink">Datos personales</h2>
        <div className="mb-4 flex items-center gap-4">
          <div className="relative">
            <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-success text-xl font-bold text-white">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : profile.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/perfil/foto" alt="Foto de perfil" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
            <label
              htmlFor="foto"
              title="Subir foto"
              className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow transition hover:bg-primary-dark"
            >
              <Camera size={13} />
            </label>
            <input
              id="foto"
              type="file"
              name="foto"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={async (event) => {
                const input = event.target;
                const file = input.files?.[0];
                if (!file) {
                  setPhotoPreview(null);
                  return;
                }
                // Conversión a WebP en el navegador antes de subir (v3 §9).
                const converted = await imageToWebp(file, 1024);
                if (converted !== file) {
                  const transfer = new DataTransfer();
                  transfer.items.add(converted);
                  input.files = transfer.files;
                }
                setPhotoPreview(URL.createObjectURL(converted));
              }}
            />
          </div>
          <p className="text-xs text-ink-soft">
            La foto se guarda localmente en <code>data/uploads/perfil/</code> y aparece en tu página pública de
            reservas. JPG, PNG o WebP, máximo 5 MB.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="nombre">
              Nombre:
            </label>
            <Input id="nombre" name="nombre" defaultValue={profile.fullName} placeholder="Juan Pérez" />
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-ink">Celular:</span>
            <PhoneInput
              dialCode={cellPhone.dialCode}
              number={cellPhone.number}
              onChange={setCellPhone}
              hiddenNameDialCode="lada"
              hiddenNameNumber="telefono"
              placeholder="Número de celular"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="descripcion">
            Descripción:
          </label>
          <Textarea
            id="descripcion"
            name="descripcion"
            rows={3}
            defaultValue={profile.description}
            placeholder="Escriba su descripción…"
          />
        </div>
      </section>

      {/* Datos profesionales y de contacto (encabezado de exportables y reportes) */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-sm font-bold text-ink">Datos profesionales y de contacto</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Estos datos aparecen en el encabezado de tus expedientes exportados y reportes firmados.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="cedula">
              Tarjeta profesional (cédula):
            </label>
            <Input
              id="cedula"
              name="cedula"
              defaultValue={profile.professionalLicense}
              placeholder="Ej. 12345678"
            />
            <p className="mt-1 text-xs text-ink-soft">
              Necesaria para <strong className="font-semibold">firmar y certificar</strong> documentos
              clínico-legales. Sin ella podrás redactar borradores, pero no firmarlos.
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm font-semibold text-ink">Teléfono de contacto:</span>
            <PhoneInput
              dialCode={contactPhone.dialCode}
              number={contactPhone.number}
              onChange={setContactPhone}
              hiddenNameDialCode="lada_contacto"
              hiddenNameNumber="telefono_contacto"
              placeholder="Número de contacto"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="direccion_contacto">
            Dirección de contacto:
          </label>
          <Textarea
            id="direccion_contacto"
            name="direccion_contacto"
            rows={2}
            maxLength={390}
            defaultValue={profile.contactAddress}
            placeholder="Dirección profesional para tus documentos"
          />
        </div>
      </section>

      {basic ? null : (
      <>
      {/* Modalidad y ubicación */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-bold text-ink">Modalidad y ubicación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="modalidad">
              Modalidad de las sesiones:
            </label>
            <Select id="modalidad" name="modalidad" defaultValue={profile.modality}>
              <option value="ambas">Ambas</option>
              <option value="presencial">Solo presencial</option>
              <option value="virtual">Solo virtual</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="maps_url">
              Liga de Google Maps:
            </label>
            <Input
              id="maps_url"
              name="maps_url"
              type="url"
              defaultValue={profile.mapsUrl}
              placeholder="https://maps.google.com/…"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="direccion">
            Dirección del consultorio:
          </label>
          <Textarea
            id="direccion"
            name="direccion"
            rows={3}
            maxLength={390}
            defaultValue={profile.address}
            placeholder="Ej. Calle 10 Norte 2030, edificio color vino, segundo piso"
          />
        </div>
      </section>

      {/* Tarifas y pagos */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-4 text-sm font-bold text-ink">Tarifas y pagos</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="precio">
              Costo de la sesión ({selectedCurrency.code}):
            </label>
            <Input
              id="precio"
              name="precio"
              type="number"
              min="0"
              step="0.01"
              defaultValue={profile.defaultPrice}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="moneda">
              Moneda:
            </label>
            <Select
              id="moneda"
              name="moneda"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {SUPPORTED_CURRENCIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} — {option.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="modo_pago">
              Opción de pago:
            </label>
            <Select id="modo_pago" name="modo_pago" defaultValue={profile.paymentMode}>
              <option value="manual">Manualmente</option>
              <option value="requerido">Requerido al agendar</option>
            </Select>
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="mostrar_precio"
            value="1"
            defaultChecked={profile.showPrice}
            className="h-4 w-4 accent-[var(--color-primary)]"
          />
          ¿Mostrar el precio de la sesión al paciente al agendar?
        </label>

        {/* Tarifas por inasistencia / cancelación tardía (spec v2 §6.3) */}
        <div className="mt-4 space-y-3 rounded-lg border border-line bg-bg p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="tarifa_inasistencia_activa"
                value="1"
                checked={noShowFeeEnabled}
                onChange={(event) => setNoShowFeeEnabled(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Cobrar tarifa por inasistencia
            </label>
            {noShowFeeEnabled ? (
              <span className="flex items-center gap-1.5">
                <span className="text-sm text-ink-soft">{selectedCurrency.symbol}</span>
                <input
                  type="number"
                  name="tarifa_inasistencia_monto"
                  min="0"
                  step="0.01"
                  defaultValue={profile.noShowFeeAmount}
                  aria-label={`Monto de la tarifa por inasistencia (${selectedCurrency.code})`}
                  className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
                />
                <span className="text-xs font-medium text-ink-soft">{selectedCurrency.code}</span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="tarifa_cancelacion_activa"
                value="1"
                checked={lateCancelFeeEnabled}
                onChange={(event) => setLateCancelFeeEnabled(event.target.checked)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Cobrar tarifa por cancelación tardía
            </label>
            {lateCancelFeeEnabled ? (
              <span className="flex items-center gap-1.5">
                <span className="text-sm text-ink-soft">{selectedCurrency.symbol}</span>
                <input
                  type="number"
                  name="tarifa_cancelacion_monto"
                  min="0"
                  step="0.01"
                  defaultValue={profile.lateCancelFeeAmount}
                  aria-label={`Monto de la tarifa por cancelación tardía (${selectedCurrency.code})`}
                  className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
                />
                <span className="text-xs font-medium text-ink-soft">{selectedCurrency.code}</span>
              </span>
            ) : null}
          </div>
          <p className="text-xs text-ink-soft">
            Al marcar una inasistencia o cancelar dentro de la ventana mínima de cancelación, la
            sesión guarda la tarifa como monto por cobrar y aparece en Pagos.
          </p>
        </div>
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-ink" htmlFor="politicas">
            Política de pago:
          </label>
          <Textarea
            id="politicas"
            name="politicas"
            rows={5}
            maxLength={390}
            value={policies}
            onChange={(event) => setPolicies(event.target.value)}
            placeholder="Escriba su política de pago"
          />
          <p className="mt-1 text-right text-xs text-ink-soft">{policies.length}/390 caracteres</p>
        </div>
      </section>

      {/* Disponibilidad semanal */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-sm font-bold text-ink">Disponibilidad de la semana</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Activa cada día y define uno o varios rangos de horario en los que recibes pacientes.
        </p>
        <div className="space-y-2">
          {DAY_ORDER.map((day) => {
            const ranges = availability[day] ?? [];
            const active = ranges.length > 0;
            return (
              <div key={day} className="flex flex-wrap items-start gap-3 rounded-lg border border-line px-3 py-2">
                <label className="flex w-28 items-center gap-2 pt-1.5 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggleDay(day)}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  {DAY_LABELS[day]}
                </label>
                {active ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {ranges.map((range, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="time"
                          value={range.from}
                          onChange={(event) => updateRange(day, index, 'from', event.target.value)}
                          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                        />
                        <span className="text-ink-soft">–</span>
                        <input
                          type="time"
                          value={range.to}
                          onChange={(event) => updateRange(day, index, 'to', event.target.value)}
                          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
                        />
                        <button
                          type="button"
                          onClick={() => removeRange(day, index)}
                          title="Quitar rango"
                          className="text-ink-soft transition hover:text-danger"
                        >
                          <X size={15} />
                        </button>
                        {index === ranges.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => addRange(day)}
                            title="Añadir rango"
                            className="text-ink-soft transition hover:text-primary dark:hover:text-accent-2"
                          >
                            <Plus size={15} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="pt-1.5 text-sm text-ink-soft">Sin disponibilidad</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Liga pública */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <h2 className="mb-1 text-sm font-bold text-ink">Liga pública de reservas</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Comparte esta liga con tus pacientes para que agenden contigo.
        </p>
        <div className="flex items-center gap-2">
          <Input readOnly value={publicLink} className="bg-bg" onFocus={(event) => event.target.select()} />
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-light px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-white"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copiada' : 'Copiar'}
          </button>
        </div>
      </section>
      </>
      )}

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  );
}
