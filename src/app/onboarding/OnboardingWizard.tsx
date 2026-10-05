'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, CreditCard, FolderOpen, Users, Wallet } from 'lucide-react';
import { WeeklyAvailabilityEditor } from '@/app/(app)/agenda/configuracion/WeeklyAvailabilityEditor';
import { PhoneInput } from '@/components/PhoneInput';
import { Input, Select, Textarea } from '@/components/ui';
import { SUPPORTED_CURRENCIES } from '@/shared/domain/currencies';
import { connectIntegrationAction, finishOnboardingAction } from './actions';
import type { OnboardingData } from './actions';
import type { OnboardingIntegrationProvider } from './localIntegrations';

const BTN_PRIMARY =
  'rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50';

const BTN_OUTLINE =
  'rounded-lg border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-bg disabled:opacity-50';

const BTN_TERTIARY =
  'rounded-lg bg-primary-light px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-white disabled:opacity-50';

type OnboardingStepKey = 'perfil' | 'ubicacion' | 'disponibilidad' | 'pago' | 'integraciones';

const STEP_LABELS: Record<OnboardingStepKey, string> = {
  perfil: 'Perfil',
  ubicacion: 'Ubicación',
  disponibilidad: 'Disponibilidad',
  pago: 'Pago',
  integraciones: 'Integraciones',
};

const ALL_STEPS: OnboardingStepKey[] = ['perfil', 'ubicacion', 'disponibilidad', 'pago', 'integraciones'];

/** v3 §3 (universidades): los miembros de una org con servicio sin costo no configuran pagos. */
const FREE_SERVICE_STEPS: OnboardingStepKey[] = ['perfil', 'ubicacion', 'disponibilidad', 'integraciones'];

/** Cards de la pantalla final (spec v2 §6.5, imagen 9.5). */
const FINAL_CARDS = [
  {
    icon: CalendarDays,
    title: 'Agenda sin límites',
    description: 'Citas ilimitadas y recordatorios por WhatsApp',
  },
  {
    icon: Users,
    title: 'Pacientes ilimitados',
    description: 'Gestiona todos tus pacientes sin restricciones',
  },
  {
    icon: FolderOpen,
    title: 'Expediente en un solo lugar',
    description: 'Historia clínica, notas y diagnóstico CIE-11',
  },
  {
    icon: Wallet,
    title: 'Organiza tus finanzas',
    description: 'Control de cobros y recordatorios automáticos',
  },
];

function StepTitle({ children }: { children: string }) {
  return (
    <div className="mb-6 text-center">
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">{children}</h1>
      <div className="mx-auto mt-2 h-1 w-14 rounded-full bg-primary" />
    </div>
  );
}

export function OnboardingWizard({
  initial,
  integrationStatuses,
  skipPaymentStep = false,
  desktopEdition = false,
}: {
  initial: OnboardingData;
  integrationStatuses: Record<OnboardingIntegrationProvider, string>;
  /** true ⇒ org con servicio sin costo: el wizard omite el paso de pago. */
  skipPaymentStep?: boolean;
  desktopEdition?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initial);
  const [statuses, setStatuses] = useState(integrationStatuses);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stepKeys = (skipPaymentStep ? FREE_SERVICE_STEPS : ALL_STEPS).filter((key) => !desktopEdition || key !== 'integraciones');
  // Paso extra «Listo» (spec v2 §6.5): el stepper muestra los pasos completos.
  const FINAL_STEP = stepKeys.length;
  const currentKey: OnboardingStepKey | 'listo' = stepKeys[step] ?? 'listo';

  const patch = (partial: Partial<OnboardingData>) => setData((prev) => ({ ...prev, ...partial }));

  const includesPresencial = data.modality === 'presencial' || data.modality === 'ambas';

  const selectedCurrency =
    SUPPORTED_CURRENCIES.find((currency) => currency.code === data.currency) ?? SUPPORTED_CURRENCIES[0];

  const canAdvance = (() => {
    if (currentKey === 'perfil') return data.fullName.trim().length > 0;
    if (currentKey === 'ubicacion') return !includesPresencial || data.address.trim().length > 0;
    if (currentKey === 'disponibilidad') return data.availability.some((day) => day.ranges.length > 0);
    if (currentKey === 'pago') return Number(data.defaultPrice) >= 0;
    return true;
  })();

  const save = () => {
    setError(null);
    startTransition(async () => {
      const result = await finishOnboardingAction(data);
      if (result && !result.ok) {
        setError(result.error ?? 'Ocurrió un error inesperado.');
      }
    });
  };

  const connect = (provider: OnboardingIntegrationProvider) => {
    startTransition(async () => {
      const result = await connectIntegrationAction(provider);
      if (result.ok) {
        setStatuses((prev) => ({ ...prev, [provider]: 'simulado' }));
      }
    });
  };

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-10 flex items-center justify-between">
        {stepKeys.map((key, index) => {
          const label = STEP_LABELS[key];
          const isDone = index < step;
          const isActive = index === step;
          return (
            <li key={key} className="flex flex-1 items-center last:flex-none">
              <span className="flex flex-col items-center">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                    isDone
                      ? 'bg-primary text-white'
                      : isActive
                        ? 'border-2 border-primary bg-surface text-primary dark:text-accent-2'
                        : 'bg-line text-ink-soft'
                  }`}
                >
                  {isDone ? <Check size={16} /> : index + 1}
                </span>
                <span
                  className={`mt-1.5 hidden text-xs sm:block ${
                    isActive ? 'font-semibold text-primary dark:text-accent-2' : 'text-ink-soft'
                  }`}
                >
                  {label}
                </span>
              </span>
              {index < stepKeys.length - 1 ? (
                <span className={`mx-2 h-0.5 flex-1 ${isDone ? 'bg-primary' : 'bg-line'}`} />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
        {currentKey === 'perfil' ? (
          <>
            <StepTitle>Empieza con tu perfil</StepTitle>
            <div className="mx-auto max-w-md space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Nombre completo: <span className="text-danger">*</span>
                </span>
                <Input
                  type="text"
                  value={data.fullName}
                  onChange={(event) => patch({ fullName: event.target.value })}
                  placeholder="Psic. Karla Hernández"
                />
              </label>
              <div>
                <span className="mb-1 block text-sm font-semibold text-ink">Celular:</span>
                <PhoneInput
                  dialCode={data.phoneCountryCode}
                  number={data.phone}
                  onChange={({ dialCode, number }) =>
                    patch({ phoneCountryCode: dialCode, phone: number })
                  }
                  placeholder="Número de celular"
                />
                <span className="mt-1 block text-xs text-ink-soft">
                  Se usa como contacto en tus recordatorios y mensajes a pacientes.
                </span>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Cédula / tarjeta profesional:
                </span>
                <Input
                  type="text"
                  value={data.professionalLicense}
                  onChange={(event) => patch({ professionalLicense: event.target.value })}
                  placeholder="Ej. 12345678"
                />
                <span className="mt-1 block text-xs text-ink-soft">
                  Aparece en tus expedientes exportados y reportes firmados. Puedes completarla
                  después en Configuración → Perfil.
                </span>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">
                  Descripción de tu práctica:
                </span>
                <Textarea
                  rows={4}
                  value={data.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  placeholder="Escriba su descripción..."
                />
                <span className="mt-1 block text-xs text-ink-soft">
                  Aparece en tu página pública de reservas.
                </span>
              </label>
            </div>
          </>
        ) : null}

        {currentKey === 'ubicacion' ? (
          <>
            <StepTitle>Configura cómo darás tus sesiones</StepTitle>
            <div className="mx-auto max-w-md space-y-4">
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-ink">
                  ¿Qué modalidad de sesiones manejas?
                </span>
                <div className="flex gap-2">
                  {[
                    { value: 'ambas', label: 'Ambas' },
                    { value: 'virtual', label: '🎥 Solo virtual' },
                    { value: 'presencial', label: '📍 Solo presencial' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => patch({ modality: option.value })}
                      className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition ${
                        data.modality === option.value
                          ? 'border-success bg-success-soft text-success'
                          : 'border-line bg-surface text-ink hover:bg-bg'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {includesPresencial ? (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-ink">
                      Dirección del consultorio: <span className="text-danger">*</span>
                    </span>
                    <Textarea
                      rows={3}
                      value={data.address}
                      onChange={(event) => patch({ address: event.target.value })}
                      placeholder="Ej. La sesión será en la calle 10 Norte 2030, en el edificio color vino, en el segundo piso (Preguntar por la psicóloga Karla Hernández)"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm font-semibold text-ink">
                      Liga de Google Maps:
                    </span>
                    <Input
                      type="url"
                      value={data.mapsUrl}
                      onChange={(event) => patch({ mapsUrl: event.target.value })}
                      placeholder="https://maps.app.goo.gl/…"
                    />
                    <span className="mt-1 block text-xs text-ink-soft">
                      Esta liga llegará en los recordatorios de sesión para que tus pacientes
                      encuentren el consultorio fácilmente.
                    </span>
                  </label>
                </>
              ) : (
                <p className="rounded-lg bg-bg p-3 text-sm text-ink-soft">
                  Tus sesiones serán por videollamada: generaremos una liga automática por cada
                  reservación virtual.
                </p>
              )}
            </div>
          </>
        ) : null}

        {currentKey === 'disponibilidad' ? (
          <>
            <StepTitle>Planifica tu disponibilidad</StepTitle>
            <p className="mx-auto mb-4 max-w-md text-center text-sm text-ink-soft">
              Activa los días que atiendes y define tus rangos de horario. Puedes agregar varios
              rangos por día.
            </p>
            <div className="mx-auto max-w-lg">
              <WeeklyAvailabilityEditor
                value={data.availability}
                onChange={(availability) => patch({ availability })}
              />
            </div>
          </>
        ) : null}

        {currentKey === 'pago' ? (
          <>
            <StepTitle>Configura tus tarifas y pagos</StepTitle>
            <div className="mx-auto max-w-md space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink">
                    Costo de la sesión ({selectedCurrency.code}):
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={data.defaultPrice}
                    onChange={(event) => patch({ defaultPrice: Number(event.target.value) })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-ink">Moneda:</span>
                  <Select
                    value={data.currency}
                    onChange={(event) => patch({ currency: event.target.value })}
                  >
                    {SUPPORTED_CURRENCIES.map((currency) => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} — {currency.name}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">Modo de pago:</span>
                <Select
                  value={data.paymentMode}
                  onChange={(event) => patch({ paymentMode: event.target.value })}
                >
                  <option value="manual">Manual (lo registras tú)</option>
                  <option value="requerido">Requerido para reservar</option>
                </Select>
              </label>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={data.showPrice}
                  onChange={(event) => patch({ showPrice: event.target.checked })}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                ¿Mostrar el precio de la sesión al paciente al agendar?
              </label>

              {/* Tarifas por inasistencia / cancelación tardía (spec v2 §6.3) */}
              <div className="space-y-3 rounded-lg border border-line bg-bg p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={data.noShowFeeEnabled}
                      onChange={(event) => patch({ noShowFeeEnabled: event.target.checked })}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    Cobrar tarifa por inasistencia
                  </label>
                  {data.noShowFeeEnabled ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm text-ink-soft">{selectedCurrency.symbol}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={data.noShowFeeAmount}
                        onChange={(event) => patch({ noShowFeeAmount: Number(event.target.value) })}
                        aria-label={`Monto de la tarifa por inasistencia (${selectedCurrency.code})`}
                        className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
                      />
                      <span className="text-xs font-medium text-ink-soft">{selectedCurrency.code}</span>
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={data.lateCancelFeeEnabled}
                      onChange={(event) => patch({ lateCancelFeeEnabled: event.target.checked })}
                      className="h-4 w-4 accent-[var(--color-primary)]"
                    />
                    Cobrar tarifa por cancelación tardía
                  </label>
                  {data.lateCancelFeeEnabled ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm text-ink-soft">{selectedCurrency.symbol}</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={data.lateCancelFeeAmount}
                        onChange={(event) =>
                          patch({ lateCancelFeeAmount: Number(event.target.value) })
                        }
                        aria-label={`Monto de la tarifa por cancelación tardía (${selectedCurrency.code})`}
                        className="w-28 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none transition focus:border-primary"
                      />
                      <span className="text-xs font-medium text-ink-soft">{selectedCurrency.code}</span>
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-ink-soft">
                  Si un paciente falta o cancela dentro de tu ventana mínima, la sesión guarda la
                  tarifa como monto por cobrar en Pagos.
                </p>
              </div>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">Política de pago:</span>
                <Textarea
                  rows={6}
                  value={data.paymentPolicies}
                  onChange={(event) => patch({ paymentPolicies: event.target.value })}
                />
                <span className="mt-1 block text-right text-xs text-ink-soft">
                  {data.paymentPolicies.length}/390 caracteres
                </span>
              </label>
            </div>
          </>
        ) : null}

        {currentKey === 'integraciones' ? (
          <>
            <StepTitle>Conectar aplicaciones</StepTitle>
            <p className="mx-auto mb-5 max-w-lg text-center text-sm text-ink-soft">
              EscuchaInterna funciona 100 % en tu equipo. Estas integraciones quedan en «modo
              local»: la app simula su comportamiento sin conectarse a servicios externos, y podrás
              activar las credenciales reales más adelante en Configuración → Integraciones.
            </p>
            <div className="mx-auto max-w-lg space-y-3">
              {(
                [
                  {
                    provider: 'google_calendar' as const,
                    icon: <CalendarDays size={20} />,
                    name: 'Google Calendar y Meet',
                    description:
                      'Sincroniza tus reservaciones con tu calendario y genera ligas de videollamada.',
                  },
                  {
                    provider: 'stripe' as const,
                    icon: <CreditCard size={20} />,
                    name: 'Stripe',
                    description: 'Habilita cobros en línea por reservaciones exitosas.',
                  },
                ]
              ).map((integration) => {
                const connected = statuses[integration.provider] !== 'desconectado';
                return (
                  <div
                    key={integration.provider}
                    className="flex items-center gap-4 rounded-card border border-line p-4"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                      {integration.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ink">{integration.name}</p>
                      <p className="text-sm text-ink-soft">{integration.description}</p>
                    </div>
                    {connected ? (
                      <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
                        ✓ Modo local
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => connect(integration.provider)}
                        className={BTN_TERTIARY}
                      >
                        Conectar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {step === FINAL_STEP ? (
          <div className="mx-auto max-w-xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-ink sm:text-3xl">
                Todo listo para transformar tu consulta
              </h1>
              <p className="mt-2 text-sm text-ink-soft">
                Acceso completo para potenciar tu práctica profesional
              </p>
              <div className="mx-auto mt-3 h-1 w-14 rounded-full bg-primary" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FINAL_CARDS.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex items-start gap-3 rounded-card border border-line p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{title}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">{desktopEdition && title === 'Agenda sin límites' ? 'Citas y disponibilidad guardadas en esta PC' : desktopEdition && title === 'Organiza tus finanzas' ? 'Registro local de cobros y pagos pendientes' : description}</p>
                  </div>
                </div>
              ))}
            </div>

            {desktopEdition ? <p className="mt-5 rounded-lg bg-primary-light p-4 text-sm text-ink">Tu consulta está lista para trabajar sin internet. Los mensajes se registran localmente; enviarlos, conectar calendarios o usar IA remota requiere un proveedor configurado. Los enlaces públicos de esta instalación funcionan solo en esta PC.</p> : null}

            <p className="mt-6 rounded-xl border border-line bg-muted/30 p-4 text-sm text-ink">
              Los términos y la política de privacidad que aceptaste al crear tu cuenta quedaron registrados con
              su versión. Puedes consultar los{' '}
                <Link href="/legal/terminos" target="_blank" className="font-medium text-primary dark:text-accent-2 hover:underline">
                  términos y condiciones
                </Link>{' '}
                y la{' '}
                <Link href="/legal/privacidad" target="_blank" className="font-medium text-primary dark:text-accent-2 hover:underline">
                  política de privacidad
                </Link>{' '}
              en cualquier momento.
            </p>
          </div>
        ) : null}

        <div className="mt-4 min-h-5 text-center">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>

        <div className="mt-2 flex items-center justify-center gap-2">
          {step > 0 ? (
            <button type="button" disabled={pending} onClick={() => setStep(step - 1)} className={BTN_OUTLINE}>
              ‹ Atrás
            </button>
          ) : null}
          {step >= 1 && step < FINAL_STEP ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setStep(FINAL_STEP)}
              className={BTN_TERTIARY}
            >
              Saltar por ahora
            </button>
          ) : null}
          {step < FINAL_STEP ? (
            <button
              type="button"
              disabled={!canAdvance || pending}
              onClick={() => setStep(step + 1)}
              className={BTN_PRIMARY}
            >
              Siguiente ›
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={save}
              className={BTN_PRIMARY}
            >
              {pending ? 'Guardando…' : 'Comenzar a usar EscuchaInterna ›'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
