'use client';

import type { ComponentType } from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { differenceInYears, format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  Cake,
  CalendarClock,
  CalendarHeart,
  CircleDot,
  Clock3,
  Compass,
  Eye,
  Flag,
  Heart,
  History,
  IdCard,
  Mail,
  MessageSquareText,
  Pencil,
  Phone,
  Pill,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Stethoscope,
  Tag,
  Users,
  X,
  type LucideProps,
} from 'lucide-react';
import type { PatientSummary } from '@/contexts/clinical-records/domain/repositories/PatientDirectory';
import { isMinor } from '@/contexts/patients/domain/value-objects/minor';
import {
  DOCUMENT_TYPES,
  formatPatientDocument,
  isDocumentTypeKey,
} from '@/contexts/patients/domain/value-objects/documentTypes';
import {
  PROCESS_STATUSES,
  SESSION_FREQUENCIES,
  SESSION_MODALITIES,
  encuadreLabel,
  processStatusLabel,
} from '@/contexts/patients/domain/value-objects/clinicalProfile';
import { PATIENT_GENDER_LABELS } from '@/contexts/patients/domain/value-objects/genderLabels';
import { Button, Card } from '@/components/ui';
import { SessionBriefingCard } from './SessionBriefingCard';
import { updatePatientSummaryAction, type UpdatePatientSummaryInput } from './actions';

function genderLabel(value: string): string {
  return (PATIENT_GENDER_LABELS as Record<string, string>)[value] ?? value;
}

function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const date = new Date(birthDate.includes('T') ? birthDate : `${birthDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const years = differenceInYears(new Date(), date);
  return years >= 0 && years < 130 ? years : null;
}

/** Ficha de un dato (icono + etiqueta + valor) para la rejilla de "Datos del paciente". */
function InfoItem({
  icon: Icon,
  label,
  value,
  hint = null,
  className = '',
  href = null,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  /** Línea secundaria opcional (p. ej. "hace 3 días"). */
  hint?: string | null;
  className?: string;
  /** Si se pasa y hay valor, el valor se vuelve un enlace (mailto:/tel:). */
  href?: string | null;
}) {
  return (
    <div className={`rounded-xl bg-bg/60 px-3.5 py-3 transition-colors hover:bg-bg ${className}`}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
        <Icon size={13} className="text-primary/60" /> {label}
      </p>
      {href && value ? (
        <a href={href} className="mt-1 block truncate text-[15px] font-medium text-primary hover:underline">
          {value}
        </a>
      ) : (
        <p className="mt-1 truncate text-[15px] font-medium text-ink">{value || '—'}</p>
      )}
      {hint ? <p className="mt-0.5 truncate text-[11px] text-ink-soft">{hint}</p> : null}
    </div>
  );
}

/** Encabezado de un grupo de fichas dentro de la card de datos. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-soft/70 dark:text-ink-soft">{children}</p>
  );
}

/** "hace 3 días" / "en 2 días" a partir de una fecha ISO; null si no hay fecha. */
function relativeHint(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return formatDistanceToNow(date, { locale: es, addSuffix: true });
}

/** Tonos de las píldoras de estado clínico (de un vistazo). */
const PILL_TONE: Record<
  'neutral' | 'primary' | 'success' | 'warning',
  { box: string; value: string; icon: string }
> = {
  neutral: { box: 'border-line bg-bg', value: 'text-ink', icon: 'text-primary/60 dark:text-accent-2/70' },
  primary: {
    // En oscuro: la salvia profunda (#5f6e3a) como TEXTO sobre el chip salvia-claro semi-transparente
    // queda ilegible → wash salvia OSCURO + texto/ícono en salvia clara (accent-2).
    box: 'border-primary/30 bg-primary-light/40 dark:border-accent-2/25 dark:bg-primary/15',
    value: 'text-primary dark:text-accent-2',
    icon: 'text-primary dark:text-accent-2',
  },
  success: { box: 'border-success/30 bg-success-soft', value: 'text-success', icon: 'text-success' },
  warning: { box: 'border-warning/40 bg-warning-soft', value: 'text-warning', icon: 'text-warning' },
};

/** Píldora compacta "etiqueta + valor" para la franja de estado clínico de un vistazo. */
function StatPill({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
  href = null,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  value: string;
  tone?: 'neutral' | 'primary' | 'success' | 'warning';
  href?: string | null;
}) {
  const t = PILL_TONE[tone];
  const inner = (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${t.box}`}>
      <Icon size={14} className={`shrink-0 ${t.icon}`} />
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">{label}</span>
      <span className={`text-sm font-semibold ${t.value}`}>{value}</span>
    </span>
  );
  return href ? (
    <Link href={href} className="transition hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export interface ActiveDiagnosisProps {
  cie11Code: string;
  cie11Title: string;
  kind: 'hipotesis' | 'formal';
  diagnosedAt: string;
}

/** Resumen clínico derivado del proceso (sin campos nuevos): continuidad + riesgo. */
export interface ClinicalSummaryProps {
  /** Total de sesiones registradas (activas, no archivadas). */
  sessionCount: number;
  /** Fecha de la última sesión registrada (ISO) o null. */
  lastSessionAt: string | null;
  /** Próxima cita agendada/confirmada (ISO) o null. */
  nextAppointmentAt: string | null;
  /** Nivel de riesgo de la última sesión (Bajo/Moderado/Alto) o null si "Sin riesgo". */
  risk: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value || '—'}</dd>
    </div>
  );
}

/** Clase compartida para inputs/selects/textareas del formulario. */
const CONTROL_CLS =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none';

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-ink">
        {label}:{required ? <span className="text-danger"> *</span> : null}
      </span>
      <input type={type} name={name} defaultValue={defaultValue} required={required} className={CONTROL_CLS} />
    </label>
  );
}

/** Encabezado de grupo dentro del formulario de edición (ocupa toda la fila). */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 border-b border-line pb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft first:mt-0 md:col-span-2">
      {children}
    </p>
  );
}

export function ResumenPanel({
  patient,
  activeDiagnosis = null,
  clinicalSummary = null,
  overviewCard = null,
  consentCard = null,
  reminderCard = null,
  notesCard = null,
  sedeCard = null,
  clinicalAccess = true,
  readOnly = false,
}: {
  patient: PatientSummary;
  activeDiagnosis?: ActiveDiagnosisProps | null;
  /** Resumen clínico derivado (continuidad + riesgo); null para el rol asistente. */
  clinicalSummary?: ClinicalSummaryProps | null;
  /** "Tratado en: [sede]" (Modo Sedes, MS2); null salvo org en modo 'compartido'. */
  sedeCard?: React.ReactNode;
  /** Card "de un vistazo" (Tier A): saldo, completitud, atajos, recordatorios. */
  overviewCard?: React.ReactNode;
  /** Card de consentimiento informado (v3 §2), renderizada por el server component. */
  consentCard?: React.ReactNode;
  /** Card de recordatorio rápido (v3 §12), renderizada por el server component. */
  reminderCard?: React.ReactNode;
  /** Card de notas privadas (bitácora del paciente); null para el rol asistente. */
  notesCard?: React.ReactNode;
  /** false para el rol asistente (v3 §4): oculta el diagnóstico (contenido clínico). */
  clinicalAccess?: boolean;
  /** true = acceso de cobertura (§2.4): solo lectura, sin botón de editar. */
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Valores pendientes de confirmar cuando el documento choca con otro paciente (§5.6).
  const [pendingValues, setPendingValues] = useState<UpdatePatientSummaryInput | null>(null);
  const [pending, startTransition] = useTransition();
  // Campos personalizados (controlados, filas dinámicas). Se reinician al abrir el editor.
  const [customFields, setCustomFields] = useState(patient.customFields);

  function openEdit() {
    setCustomFields(patient.customFields);
    setError(null);
    setDuplicateWarning(null);
    setEditing(true);
  }

  function updateCustomField(index: number, key: 'label' | 'value', value: string) {
    setCustomFields((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  }

  function addCustomField() {
    setCustomFields((rows) => [...rows, { label: '', value: '' }]);
  }

  function removeCustomField(index: number) {
    setCustomFields((rows) => rows.filter((_, i) => i !== index));
  }

  function save(input: UpdatePatientSummaryInput) {
    startTransition(async () => {
      const result = await updatePatientSummaryAction(patient.id, input);
      if (result.ok) {
        setError(null);
        setDuplicateWarning(null);
        setPendingValues(null);
        setEditing(false);
      } else if (result.duplicateWarning) {
        // Avisa (no bloquea): conserva los valores para reenviarlos confirmados.
        setError(null);
        setDuplicateWarning(result.duplicateWarning);
        setPendingValues(input);
      } else {
        setDuplicateWarning(null);
        setError(result.error ?? 'No se pudo guardar.');
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? '');
    save({
      fullName: read('fullName'),
      email: read('email'),
      phone: read('phone'),
      birthDate: read('birthDate'),
      gender: read('gender'),
      consultationReason: read('consultationReason'),
      therapyStartDate: read('therapyStartDate'),
      emergencyContactName: read('emergencyContactName'),
      emergencyContactPhone: read('emergencyContactPhone'),
      // Las notas ahora viven en la bitácora (PatientNotesCard); aquí se preserva
      // el campo heredado tal cual para no pisarlo al editar la ficha.
      notes: patient.notes,
      tags: read('tags'),
      documentType: read('documentType'),
      documentNumber: read('documentNumber'),
      guardianName: read('guardianName'),
      guardianRelationship: read('guardianRelationship'),
      guardianDocument: read('guardianDocument'),
      // Si el actor no ve la sección clínica (asistente), NO se reescriben estos
      // campos con vacío: se conservan los valores actuales del paciente.
      currentMedication: clinicalAccess ? read('currentMedication') : patient.currentMedication,
      medicalHistory: clinicalAccess ? read('medicalHistory') : patient.medicalHistory,
      sessionFrequency: read('sessionFrequency'),
      sessionModality: read('sessionModality'),
      processStatus: read('processStatus'),
      treatmentEndDate: read('treatmentEndDate'),
      treatmentEndReason: read('treatmentEndReason'),
      insuranceName: read('insuranceName'),
      insurancePolicyNumber: read('insurancePolicyNumber'),
      referralSource: read('referralSource'),
      customFields,
    });
  }

  if (editing) {
    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Editar datos del paciente</h2>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-line p-1.5 text-ink-soft hover:text-ink"
            aria-label="Cancelar edición"
          >
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-x-4 gap-y-3 md:grid-cols-2">
          <SectionHeader>Identificación</SectionHeader>
          <Field label="Nombre" name="fullName" defaultValue={patient.fullName} required />
          {clinicalAccess ? (
            <>
          <Field label="Fecha de nacimiento" name="birthDate" type="date" defaultValue={patient.birthDate ?? ''} />
          <label className="block">
            <span className="text-sm font-semibold text-ink">Género:</span>
            <select name="gender" defaultValue={patient.gender} className={CONTROL_CLS}>
              <option value="">Sin especificar</option>
              <option value="femenino">Femenino</option>
              <option value="masculino">Masculino</option>
              <option value="no_binario">No binario</option>
              <option value="otro">Otro</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Tipo de documento:</span>
            <select
              name="documentType"
              defaultValue={isDocumentTypeKey(patient.documentType) ? patient.documentType : ''}
              className={CONTROL_CLS}
            >
              <option value="">Sin especificar</option>
              {DOCUMENT_TYPES.map((doc) => (
                <option key={doc.key} value={doc.key}>
                  {doc.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Número de documento" name="documentNumber" defaultValue={patient.documentNumber} />
            </>
          ) : null}

          <SectionHeader>Contacto</SectionHeader>
          <Field label="Email" name="email" type="email" defaultValue={patient.email} />
          <Field label="Celular" name="phone" defaultValue={patient.phone} />

          {clinicalAccess ? (
            <>
          <SectionHeader>Representante legal (acudiente)</SectionHeader>
          <p className="text-xs text-ink-soft md:col-span-2">
            Obligatorio para pacientes menores de edad. Quien otorga el consentimiento informado en
            nombre del menor.
          </p>
          <Field label="Nombre del representante" name="guardianName" defaultValue={patient.guardianName} />
          <Field
            label="Parentesco / relación"
            name="guardianRelationship"
            defaultValue={patient.guardianRelationship}
          />
          <Field
            label="Documento del representante"
            name="guardianDocument"
            defaultValue={patient.guardianDocument}
          />

          <SectionHeader>Proceso terapéutico</SectionHeader>
          <Field
            label="Fecha de inicio de terapia"
            name="therapyStartDate"
            type="date"
            defaultValue={patient.therapyStartDate ?? ''}
          />
          <label className="block">
            <span className="text-sm font-semibold text-ink">Estado del proceso:</span>
            <select name="processStatus" defaultValue={patient.processStatus || 'activo'} className={CONTROL_CLS}>
              {PROCESS_STATUSES.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Frecuencia de sesiones:</span>
            <select name="sessionFrequency" defaultValue={patient.sessionFrequency} className={CONTROL_CLS}>
              <option value="">Sin especificar</option>
              {SESSION_FREQUENCIES.map((frequency) => (
                <option key={frequency.key} value={frequency.key}>
                  {frequency.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Modalidad:</span>
            <select name="sessionModality" defaultValue={patient.sessionModality} className={CONTROL_CLS}>
              <option value="">Sin especificar</option>
              {SESSION_MODALITIES.map((modality) => (
                <option key={modality.key} value={modality.key}>
                  {modality.label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Fecha de fin de tratamiento"
            name="treatmentEndDate"
            type="date"
            defaultValue={patient.treatmentEndDate ?? ''}
          />
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-ink">Motivo de finalización:</span>
            <textarea
              name="treatmentEndReason"
              defaultValue={patient.treatmentEndReason}
              rows={2}
              placeholder="Por qué se cerró el proceso (alta, derivación, abandono…)"
              className={CONTROL_CLS}
            />
          </label>

          {clinicalAccess ? (
            <>
              <SectionHeader>Información clínica</SectionHeader>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-ink">
                  Medicación actual{' '}
                  <span className="font-normal text-ink-soft">(fármaco, dosis, quién la prescribe)</span>:
                </span>
                <textarea name="currentMedication" defaultValue={patient.currentMedication} rows={2} className={CONTROL_CLS} />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-ink">Alergias y antecedentes médicos relevantes:</span>
                <textarea name="medicalHistory" defaultValue={patient.medicalHistory} rows={2} className={CONTROL_CLS} />
              </label>
            </>
          ) : null}
            </>
          ) : null}

          <SectionHeader>Contacto de emergencia</SectionHeader>
          <Field label="Nombre" name="emergencyContactName" defaultValue={patient.emergencyContactName} />
          <Field label="Celular" name="emergencyContactPhone" defaultValue={patient.emergencyContactPhone} />

          {clinicalAccess ? (
            <>
          <SectionHeader>Seguro y derivación</SectionHeader>
          <Field label="Seguro" name="insuranceName" defaultValue={patient.insuranceName} />
          <Field label="Número de póliza" name="insurancePolicyNumber" defaultValue={patient.insurancePolicyNumber} />
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-ink">Derivación / cómo nos conoció:</span>
            <input
              name="referralSource"
              defaultValue={patient.referralSource}
              placeholder="Recomendación, EPS, Instagram, otro profesional…"
              className={CONTROL_CLS}
            />
          </label>

          <SectionHeader>Motivo y etiquetas</SectionHeader>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-ink">Motivo de consulta:</span>
            <textarea name="consultationReason" defaultValue={patient.consultationReason} rows={3} className={CONTROL_CLS} />
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-ink">Etiquetas (separadas por coma):</span>
            <input name="tags" defaultValue={patient.tags.join(', ')} className={CONTROL_CLS} />
          </label>

          <SectionHeader>Campos personalizados</SectionHeader>
          {customFields.length === 0 ? (
            <p className="text-xs text-ink-soft md:col-span-2">
              Sin campos personalizados. Agrega los que tu práctica necesite (p. ej. «Empresa», «Religión»…).
            </p>
          ) : null}
          {customFields.map((field, index) => (
            <div key={index} className="flex items-center gap-2 md:col-span-2">
              <input
                value={field.label}
                onChange={(event) => updateCustomField(index, 'label', event.target.value)}
                placeholder="Etiqueta"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              />
              <input
                value={field.value}
                onChange={(event) => updateCustomField(index, 'value', event.target.value)}
                placeholder="Valor"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeCustomField(index)}
                aria-label="Quitar campo"
                className="shrink-0 rounded-lg border border-line p-2 text-ink-soft transition hover:border-danger hover:text-danger"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={addCustomField}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-bg"
            >
              + Agregar campo
            </button>
          </div>
            </>
          ) : null}

          {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
          {duplicateWarning ? (
            <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink md:col-span-2">
              {duplicateWarning}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <Button
              type="submit"
              disabled={pending}
              className="disabled:opacity-50"
            >
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
            {duplicateWarning && pendingValues ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => save({ ...pendingValues, confirmDuplicate: true })}
                className="rounded-lg border border-warning bg-warning/10 px-4 py-2 text-sm font-semibold text-ink hover:bg-warning/20 disabled:opacity-50"
              >
                Guardar de todos modos
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Card>
    );
  }

  const documento = formatPatientDocument(
    isDocumentTypeKey(patient.documentType) ? patient.documentType : '',
    patient.documentNumber,
  );
  const age = ageFrom(patient.birthDate);
  const isMinorPatient = isMinor(patient.birthDate);
  const gender = patient.gender ? genderLabel(patient.gender) : '';
  const encuadre = encuadreLabel(patient.sessionFrequency, patient.sessionModality);
  const estado = processStatusLabel(patient.processStatus) || 'Activo';
  // Tono del estado: en curso = verde; cerrado/alta = neutro; cualquier otro = ámbar.
  const estadoTone: 'success' | 'neutral' | 'warning' =
    !patient.processStatus || patient.processStatus === 'activo'
      ? 'success'
      : /alta|cerr|fin/i.test(patient.processStatus)
        ? 'neutral'
        : 'warning';
  const nextAppt = clinicalSummary?.nextAppointmentAt ?? null;

  // Banner de riesgo (lo más crítico a nivel clínico): tono según el nivel
  // reportado en la última sesión. "Alto" = peligro; "Moderado" = advertencia.
  const risk = clinicalSummary?.risk ?? null;
  const riskTone: 'danger' | 'warning' | 'caution' | null = risk
    ? /alto|sever|crí|crit|inminente/i.test(risk)
      ? 'danger'
      : /moder/i.test(risk)
        ? 'warning'
        : 'caution'
    : null;

  return (
    <div className="space-y-4">
      {/* Estado clínico de un vistazo: lo esencial al abrir el paciente. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatPill icon={CircleDot} label="Estado" value={estado} tone={estadoTone} />
          {clinicalAccess && activeDiagnosis ? (
            <Link
              href={`/pacientes/${patient.id}/diagnostico`}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-light/40 px-3 py-1.5 transition hover:opacity-80 dark:border-accent-2/25 dark:bg-primary/15"
            >
              <Stethoscope size={14} className="shrink-0 text-primary dark:text-accent-2" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-ink-soft">Diagnóstico</span>
              <span className="font-mono text-sm font-semibold text-primary dark:text-accent-2">{activeDiagnosis.cie11Code}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  activeDiagnosis.kind === 'formal' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
                }`}
              >
                {activeDiagnosis.kind === 'formal' ? 'formal' : 'hipótesis'}
              </span>
            </Link>
          ) : null}
          {clinicalSummary ? (
            <StatPill
              icon={CalendarClock}
              label="Próxima cita"
              value={nextAppt ? formatDate(nextAppt) : 'Sin agendar'}
              tone={nextAppt ? 'primary' : 'neutral'}
            />
          ) : null}
          {clinicalSummary ? (
            <StatPill icon={Activity} label="Sesiones" value={String(clinicalSummary.sessionCount)} tone="neutral" />
          ) : null}
        </div>
        {readOnly ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-bg px-3 py-1.5 text-xs font-medium text-ink-soft">
            <Eye size={13} /> Solo lectura
          </span>
        ) : (
          <Button
            variant="soft"
            size="sm"
            type="button"
            onClick={openEdit}
            title="Editar todos los datos del paciente (identificación, contacto, proceso, seguro, etc.)"
            className="text-sm"
          >
            <Pencil size={14} /> Editar ficha
          </Button>
        )}
      </div>

      {risk ? (
        <div
          className={`flex items-start gap-3 rounded-card border px-4 py-3 ${
            riskTone === 'danger'
              ? 'border-danger/40 bg-danger-soft'
              : riskTone === 'warning'
                ? 'border-warning/40 bg-warning-soft'
                : 'border-line bg-bg'
          }`}
        >
          <ShieldAlert
            size={20}
            className={`mt-0.5 shrink-0 ${
              riskTone === 'danger'
                ? 'text-danger'
                : riskTone === 'warning'
                  ? 'text-warning'
                  : 'text-ink-soft'
            }`}
          />
          <div className="min-w-0">
            <p className={`text-sm font-bold ${riskTone === 'danger' ? 'text-danger' : 'text-ink'}`}>
              Riesgo {risk.toLowerCase()} registrado en la última sesión
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">
              {clinicalSummary?.lastSessionAt
                ? `Reportado el ${formatDate(clinicalSummary.lastSessionAt)}. `
                : ''}
              Revisa el plan de seguridad en la{' '}
              <Link
                href={`/pacientes/${patient.id}/historia`}
                className="font-medium text-primary hover:underline"
              >
                evolución del expediente
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      {clinicalAccess && !readOnly ? <SessionBriefingCard patientId={patient.id} /> : null}

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-4 text-base font-bold text-ink">Datos del paciente</h2>

          <div className="space-y-4">
            <section>
              <GroupLabel>Identificación</GroupLabel>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <InfoItem icon={IdCard} label="Documento" value={documento} />
                <InfoItem
                  icon={Cake}
                  label="Nacimiento"
                  value={`${formatDate(patient.birthDate)}${age !== null ? ` · ${age} años` : ''}`}
                />
                <InfoItem icon={Heart} label="Género" value={gender} />
              </div>
            </section>

            <section>
              <GroupLabel>Contacto</GroupLabel>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <InfoItem
                  icon={Mail}
                  label="Correo"
                  value={patient.email}
                  href={patient.email ? `mailto:${patient.email}` : null}
                />
                <InfoItem
                  icon={Phone}
                  label="Celular"
                  value={patient.phone}
                  href={patient.phone ? `tel:${patient.phone.replace(/\s+/g, '')}` : null}
                />
              </div>
            </section>

            {patient.guardianName || patient.guardianRelationship || patient.guardianDocument ? (
              <section>
                <GroupLabel>Representante legal (acudiente)</GroupLabel>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <InfoItem icon={Users} label="Nombre" value={patient.guardianName} />
                  <InfoItem icon={Heart} label="Parentesco" value={patient.guardianRelationship} />
                  <InfoItem
                    icon={IdCard}
                    label="Documento"
                    value={patient.guardianDocument}
                    className="sm:col-span-2"
                  />
                </div>
              </section>
            ) : isMinorPatient ? (
              <section>
                <GroupLabel>Representante legal (acudiente)</GroupLabel>
                <p className="rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-warning">
                  Este paciente es menor de edad y aún no tiene un representante legal registrado.
                  Edita la ficha para agregarlo; es quien firma el consentimiento informado.
                </p>
              </section>
            ) : null}

            <section>
              <GroupLabel>Proceso terapéutico</GroupLabel>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <InfoItem icon={CircleDot} label="Estado del proceso" value={estado} />
                <InfoItem icon={Repeat} label="Encuadre" value={encuadre} />
                <InfoItem
                  icon={CalendarHeart}
                  label="Inicio de terapia"
                  value={formatDate(patient.therapyStartDate)}
                />
                {patient.treatmentEndDate ? (
                  <InfoItem
                    icon={Flag}
                    label="Fin de tratamiento"
                    value={formatDate(patient.treatmentEndDate)}
                    hint={patient.treatmentEndReason || null}
                  />
                ) : null}
                <InfoItem icon={Clock3} label="Paciente desde" value={formatDate(patient.createdAt)} />
                {clinicalSummary ? (
                  <InfoItem
                    icon={History}
                    label="Última sesión"
                    value={formatDate(clinicalSummary.lastSessionAt)}
                    hint={relativeHint(clinicalSummary.lastSessionAt)}
                  />
                ) : null}
                <InfoItem
                  icon={Tag}
                  label="Etiquetas"
                  value={patient.tags.join(', ')}
                  className="sm:col-span-2"
                />
              </div>
            </section>

            {patient.insuranceName || patient.insurancePolicyNumber || patient.referralSource ? (
              <section>
                <GroupLabel>Seguro y derivación</GroupLabel>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {patient.insuranceName ? (
                    <InfoItem icon={ShieldCheck} label="Seguro" value={patient.insuranceName} />
                  ) : null}
                  {patient.insurancePolicyNumber ? (
                    <InfoItem icon={IdCard} label="Nº de póliza" value={patient.insurancePolicyNumber} />
                  ) : null}
                  {patient.referralSource ? (
                    <InfoItem
                      icon={Compass}
                      label="Derivación / cómo nos conoció"
                      value={patient.referralSource}
                      className="sm:col-span-2"
                    />
                  ) : null}
                </div>
              </section>
            ) : null}

            {patient.customFields.length > 0 ? (
              <section>
                <GroupLabel>Campos personalizados</GroupLabel>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {patient.customFields.map((field, index) => (
                    <InfoItem key={`${field.label}-${index}`} icon={Tag} label={field.label} value={field.value} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </Card>

      <div className="space-y-4">
        {sedeCard}
        {overviewCard}
        {consentCard}
        {reminderCard}
        {clinicalAccess ? (
          <Card>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Stethoscope size={15} className="text-primary" /> Diagnóstico activo
            </h3>
            {activeDiagnosis ? (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3 py-1 text-sm font-semibold text-primary">
                    <span className="font-mono">{activeDiagnosis.cie11Code}</span>
                  </span>
                  {activeDiagnosis.kind === 'hipotesis' ? (
                    <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
                      Hipótesis diagnóstica
                    </span>
                  ) : (
                    <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                      Diagnóstico formal
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-medium text-ink">{activeDiagnosis.cie11Title}</p>
                <p className="mt-0.5 text-xs text-ink-soft">
                  Registrado el {formatDate(activeDiagnosis.diagnosedAt)} ·{' '}
                  <Link href={`/pacientes/${patient.id}/diagnostico`} className="text-primary dark:text-accent-2 hover:underline">
                    Ver diagnósticos
                  </Link>
                </p>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">
                Sin diagnóstico activo.{' '}
                <Link href={`/pacientes/${patient.id}/diagnostico`} className="text-primary hover:underline">
                  Registrar uno
                </Link>
                .
              </p>
            )}
          </Card>
        ) : null}
        {clinicalAccess && (patient.currentMedication || patient.medicalHistory) ? (
          <Card>
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Pill size={15} className="text-ink-soft" /> Información médica
            </h3>
            <div className="space-y-3">
              {patient.currentMedication ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Medicación actual
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                    {patient.currentMedication}
                  </p>
                </div>
              ) : null}
              {patient.medicalHistory ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Alergias y antecedentes
                  </p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                    {patient.medicalHistory}
                  </p>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}
        <Card>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Siren size={15} className="text-ink-soft" /> Contacto de emergencia
          </h3>
          {patient.emergencyContactName || patient.emergencyContactPhone ? (
            <dl className="space-y-3">
              <Row label="Nombre" value={patient.emergencyContactName} />
              <Row label="Celular" value={patient.emergencyContactPhone} />
            </dl>
          ) : (
            <p className="text-sm text-ink-soft">Sin contacto de emergencia registrado.</p>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
            <MessageSquareText size={15} className="text-ink-soft" /> Motivo de consulta
          </h3>
          <p className="whitespace-pre-wrap text-sm text-ink">
            {patient.consultationReason || 'Sin motivo registrado.'}
          </p>
        </Card>
        {notesCard}
        </div>
      </div>
    </div>
  );
}
