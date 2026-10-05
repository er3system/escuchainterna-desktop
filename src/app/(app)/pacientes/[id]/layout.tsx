import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { differenceInYears } from 'date-fns';
import { Eye, FileSignature, Mail, Phone, ShieldAlert } from 'lucide-react';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { isAssistantUser } from '@/shared/infrastructure/auth/dataOwner';
import { patientContactSummary, resolvePatientAccess } from '@/shared/infrastructure/auth/patientAccess';
import { GetLatestPatientConsent } from '@/contexts/clinical-records/application/get-patient-consent/GetLatestPatientConsent';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { isConsentGranted } from '@/contexts/clinical-records/domain/value-objects/consentStatus';
import { Badge } from '@/components/ui';
import { PatientTabs } from './PatientTabs';
import { auditExpedienteAccess } from './expedienteGuard';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

export default async function PatientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const sessionUserId = await requireSessionUserId();
  // Asistente (v3 §4): ve los datos del titular, pero sin pestañas clínicas.
  const assistantView = await isAssistantUser(sessionUserId);
  const { id } = await params;

  // Resolutor ÚNICO de acceso (§2.4): asignado ('owner') o cobertura institucional
  // ('coverage', que ya deja rastro 'acceso_cobertura'); cualquier otro caso → 404.
  const access = await resolvePatientAccess(sessionUserId, id);
  if (!access) notFound();
  const patient = assistantView ? patientContactSummary(access.patient) : access.patient;
  const coverage = access.mode === 'coverage';
  // Compartido explícito en SOLO LECTURA (Ajustes › Compartir): un colega de la misma
  // org al que el tratante concedió lectura por paciente. Igual que la cobertura, es
  // solo el resumen; el resolutor ya dejó la traza 'acceso_compartido'.
  const shared = access.mode === 'share';
  // Custodia institucional (§3.3): lectura COMPLETA pero de ruptura de cristal; el
  // resolutor ya dejó la traza 'acceso_cobertura' y el guard la repite por área.
  const custody = access.mode === 'custody';
  // Cobertura y compartido: misma plomería de SOLO-LECTURA del resumen.
  const summaryOnly = coverage || shared;

  // Fail-closed (§2.4): la lectura de cobertura/compartida es SOLO el resumen. Las
  // pestañas profundas (historia, sesiones, …) están acotadas al actor y mostrarían su
  // propia vista vacía con acciones de escritura, así que cualquier sub-ruta redirige
  // al resumen. El expediente completo requiere asignación.
  if (summaryOnly) {
    const pathname = (await headers()).get('x-pathname') ?? '';
    const detailBase = `/pacientes/${id}`;
    if (pathname.startsWith(`${detailBase}/`)) redirect(detailBase);
  }

  // Bitácora de acceso + bloqueo del rol asistente (v3 §1.2) SOLO en acceso propio:
  // cobertura y compartido ya quedaron trazados en el resolutor y no los alcanza un
  // asistente.
  if (!summaryOnly) await auditExpedienteAccess(id);

  const age = patient.birthDate ? differenceInYears(new Date(), new Date(patient.birthDate)) : null;

  // Aviso (NO bloqueante) de consentimiento: solo en la vista del tratante dueño (quien
  // registra datos clínicos), si el paciente está activo y aún no hay consentimiento
  // otorgado. La Ley 1581 exige autorización previa para datos sensibles; no bloqueamos
  // (decisión de producto), solo recordamos.
  const isOwnerView = !summaryOnly && !custody;
  let consentReminder = false;
  if (isOwnerView && !patient.archived) {
    const consent = await new GetLatestPatientConsent(new SqlitePatientConsentRepository(sessionUserId)).execute(id);
    consentReminder = !consent || !isConsentGranted(consent.status);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-lg font-bold text-primary">
          {initialsOf(patient.fullName) || '?'}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-ink">{patient.fullName}</h1>
            <Badge tone={patient.archived ? 'neutral' : 'success'}>
              {patient.archived ? 'Archivado' : '• Activo'}
            </Badge>
            {age !== null ? <span className="text-sm text-ink-soft">{age} años</span> : null}
            {age !== null && age < 18 ? <Badge tone="warning">Menor de edad</Badge> : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
            {patient.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone size={14} /> {patient.phone}
              </span>
            ) : null}
            {patient.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail size={14} /> {patient.email}
              </span>
            ) : null}
          </div>
          {patient.tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patient.tags.map((tag) => (
                <Badge key={tag} tone="primary">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {coverage ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/40 dark:bg-primary/15 px-4 py-2.5 text-sm text-ink">
          <Eye size={16} className="shrink-0 text-primary dark:text-accent-2" />
          <span>
            <span className="font-semibold">Acceso de cobertura</span> · este expediente es de otro
            tratante de tu organización. Ves solo el resumen (lectura) y tu acceso queda registrado.
            Para el expediente completo, pide que te asignen el paciente.
          </span>
        </div>
      ) : null}
      {shared ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/40 dark:bg-primary/15 px-4 py-2.5 text-sm text-ink">
          <Eye size={16} className="shrink-0 text-primary dark:text-accent-2" />
          <span>
            <span className="font-semibold">Compartido contigo</span> · un colega de tu organización
            te dio acceso de lectura a este expediente. Ves solo el resumen y tu acceso queda
            registrado. Quien lo comparte puede revocarlo cuando quiera.
          </span>
        </div>
      ) : null}
      {custody ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-ink">
          <ShieldAlert size={16} className="shrink-0 text-warning" />
          <span>
            <span className="font-semibold">Custodia institucional</span> · este expediente quedó
            retenido por la institución tras la baja de su tratante. Puedes consultarlo en modo de
            solo lectura para dar continuidad y cada acceso queda registrado en la bitácora.
            Reasígnalo a un tratante para volver a habilitar cambios clínicos.
          </span>
        </div>
      ) : null}
      {consentReminder ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-ink">
          <FileSignature size={16} className="shrink-0 text-warning" />
          <span className="flex-1 min-w-0">
            <span className="font-semibold">Sin consentimiento informado firmado.</span>{' '}
            La Ley 1581 pide la autorización del titular antes de registrar datos clínicos. Puedes
            continuar, pero gestiónalo pronto.
          </span>
          <Link
            href={`/pacientes/${id}/consentimiento`}
            className="whitespace-nowrap font-semibold text-warning hover:underline"
          >
            Gestionar →
          </Link>
        </div>
      ) : null}
      <PatientTabs patientId={id} clinicalAccess={!assistantView} coverage={summaryOnly} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
