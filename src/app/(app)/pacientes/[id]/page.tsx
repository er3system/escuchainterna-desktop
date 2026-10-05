import { notFound } from 'next/navigation';
import { SqliteActiveDiagnosisReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteActiveDiagnosisReader';
import { GetLatestPatientConsent } from '@/contexts/clinical-records/application/get-patient-consent/GetLatestPatientConsent';
import { SqlitePatientConsentRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientConsentRepository';
import { ListSessionNotes } from '@/contexts/clinical-records/application/list-session-notes/ListSessionNotes';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqlitePatientBookingsReader } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientBookingsReader';
import { ListPayments } from '@/contexts/billing/application/list-payments/ListPayments';
import { ListPaymentsQuery } from '@/contexts/billing/application/list-payments/ListPaymentsQuery';
import { currencyLinesOrZero } from '@/contexts/billing/domain/value-objects/currencyTotals';
import { SqliteBillingProfileRepository } from '@/contexts/billing/infrastructure/persistence/SqliteBillingProfileRepository';
import { SqlitePaymentsLedger } from '@/contexts/billing/infrastructure/persistence/SqlitePaymentsLedger';
import { GetExpedienteGaps } from '@/contexts/clinical-records/application/get-expediente-gaps/GetExpedienteGaps';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { ListPatientFiles } from '@/contexts/clinical-records/application/list-patient-files/ListPatientFiles';
import { SqlitePatientFileRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientFileRepository';
import { ListPatientReports } from '@/contexts/clinical-records/application/list-patient-reports/ListPatientReports';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqliteRelationalCaseRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteRelationalCaseRepository';
import { SqlitePatientNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientNoteRepository';
import { SqliteNotificationRepository } from '@/contexts/notifications/infrastructure/persistence/SqliteNotificationRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { isAssistantUser } from '@/shared/infrastructure/auth/dataOwner';
import { patientContactSummary, resolvePatientAccess } from '@/shared/infrastructure/auth/patientAccess';
import { getAppBaseUrl } from '@/shared/infrastructure/config/appBaseUrl';
import { ResumenPanel } from './ResumenPanel';
import { patientSedeContext } from './sede';
import { TratadoEnCard } from './TratadoEnCard';
import { PatientOverviewCard, type PatientOverview } from './PatientOverviewCard';
import { PatientNotesCard } from './PatientNotesCard';
import { ConsentCard, type ConsentCardData } from './consentimiento/ConsentCard';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { NewReminderForm } from '../../notificaciones/NewReminderForm';

export default async function ResumenPage({ params }: { params: Promise<{ id: string }> }) {
  const sessionUserId = await requireSessionUserId();
  // El asistente ve el Resumen con los datos del titular, pero SIN el
  // diagnóstico (contenido clínico reservado al profesional, v3 §4).
  const assistantView = await isAssistantUser(sessionUserId);
  const { id } = await params;
  // Acceso ÚNICO (§2.4): propio o cobertura (acotado al tratante real, ya trazado).
  const access = await resolvePatientAccess(sessionUserId, id);
  if (!access) notFound();
  const ownerUserId = access.ownerUserId;
  // Cobertura y compartido: ambos son SOLO lectura del resumen (sin acciones de escritura).
  const coverage = access.mode === 'coverage' || access.mode === 'share';
  const custody = access.mode === 'custody';
  const readOnly = coverage || custody;
  const patient = assistantView ? patientContactSummary(access.patient) : access.patient;

  const diagnosis = assistantView ? null : await new SqliteActiveDiagnosisReader(ownerUserId).latestForPatient(id);
  const activeDiagnosis = diagnosis
    ? {
        cie11Code: diagnosis.cie11Code,
        cie11Title: diagnosis.cie11Title,
        kind: diagnosis.kind,
        diagnosedAt: diagnosis.diagnosedAt,
      }
    : null;

  // Resumen clínico del proceso (derivado, sin campos nuevos): continuidad + riesgo.
  // Solo para el profesional (no el asistente): es contenido clínico.
  const clinicalSummary = assistantView
    ? null
    : await (async () => {
        const notes = await new ListSessionNotes(new SqliteSessionNoteRepository(ownerUserId)).execute(id);
        const latest = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        const riskRaw = latest?.answers['riesgo-nivel'];
        const risk =
          typeof riskRaw === 'string' && riskRaw !== '' && riskRaw.toLowerCase() !== 'sin riesgo'
            ? riskRaw
            : null;
        const bookings = await new SqlitePatientBookingsReader(ownerUserId).listByPatient(id);
        const nowIso = new Date().toISOString();
        const next = bookings
          .filter((b) => b.startAt > nowIso && (b.status === 'agendada' || b.status === 'confirmada'))
          .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
        return {
          sessionCount: notes.length,
          lastSessionAt: latest?.createdAt ?? null,
          nextAppointmentAt: next?.startAt ?? null,
          risk,
        };
      })();

  // Consentimiento informado (v3 §2): badge + acciones en el Resumen.
  const consent = assistantView
    ? null
    : await new GetLatestPatientConsent(new SqlitePatientConsentRepository(ownerUserId)).execute(id);
  const consentData: ConsentCardData = consent
    ? {
        status: consent.status,
        sentAt: consent.sentAt,
        signedAt: consent.signedAt,
        signedName: consent.signedName,
        hasFile: consent.filePath !== null && consent.filePath !== '',
        signUrl:
          consent.status === 'pendiente' ? `${getAppBaseUrl()}/consentimiento/${consent.token}` : null,
      }
    : { status: null, sentAt: null, signedAt: null, signedName: '', hasFile: false, signUrl: null };

  // Recordatorio rápido sobre el paciente (v3 §12): sección pequeña; si lo
  // crea un asistente también se le crea al titular. En cobertura NO se ofrece
  // (es una acción de escritura; la cobertura es solo lectura).
  const reminderCard = readOnly ? null : (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-soft">Recordatorio</h3>
      <NewReminderForm
        compact
        defaultPatientId={id}
        patients={[{ id, fullName: patient.fullName }]}
      />
    </div>
  );

  // Capa operativa "de un vistazo" (Tier A): datos que ya viven en otras
  // pestañas (saldo, completitud, atajos, recordatorios). Las secciones clínicas
  // (gaps/reportes/vínculos) llegan en null para el asistente.
  const paymentsPage = await new ListPayments(new SqlitePaymentsLedger(ownerUserId)).list(
    ListPaymentsQuery.fromPrimitives({ onlyCompleted: '0', patientId: id }),
  );
  const billingCurrency =
    (await new SqliteBillingProfileRepository(ownerUserId).findCurrent())?.currency ?? 'COP';
  const pending = currencyLinesOrZero(paymentsPage.pendingByCurrency, billingCurrency)
    .filter((line) => line.amount > 0)
    .map((line) => ({ currency: line.currency, amount: line.amount }));

  const fileCount = assistantView
    ? 0
    : (await new ListPatientFiles(new SqlitePatientFileRepository(ownerUserId)).execute(id)).length;

  const reminders = (
    await new SqliteNotificationRepository().listScheduledForPatient(
      ownerUserId,
      id,
      new Date().toISOString(),
      4,
    )
  ).map((n) => ({ id: n.id, title: n.title, remindAt: n.remindAt ?? '' }));

  const gaps = assistantView
    ? null
    : await new GetExpedienteGaps({
        patients: new SqlitePatientDirectory(ownerUserId),
        records: new SqliteClinicalRecordRepository(ownerUserId),
        notes: new SqliteSessionNoteRepository(ownerUserId),
        diagnoses: new SqliteDiagnosisRepository(ownerUserId),
        identity: new SqliteProfessionalIdentityReader(ownerUserId),
      }).execute(id);

  const reports = assistantView
    ? null
    : await (async () => {
        const list = await new ListPatientReports(new SqlitePatientReportRepository(ownerUserId)).execute(id);
        return { total: list.length, signed: list.filter((report) => report.status === 'firmado').length };
      })();

  const relational = assistantView
    ? null
    : await (async () => {
        const cases = await new SqliteRelationalCaseRepository(ownerUserId).listByPatient(id);
        return { count: cases.length, contraindicado: cases.some((c) => c.isContraindicated()) };
      })();

  const overview: PatientOverview = {
    patientId: id,
    pending,
    gaps,
    fileCount,
    reports,
    relational,
    reminders,
  };

  // Bitácora de notas privadas (no entra al expediente firmable). Clínico:
  // oculta al asistente. En cobertura/compartido es solo lectura.
  const patientNotes = assistantView ? [] : await new SqlitePatientNoteRepository(ownerUserId).list(id);
  const notesCard = assistantView ? null : (
    <PatientNotesCard
      patientId={id}
      notes={patientNotes}
      readOnly={readOnly}
    />
  );

  // "Tratado en: [sede]" (Modo Sedes, MS2): solo si la org del tratante está en modo
  // 'compartido'. Editable por el tratante (en cobertura/compartido = solo lectura).
  const sedeContext = await patientSedeContext(id, ownerUserId);
  const sedeCard = sedeContext ? (
    <TratadoEnCard
      patientId={id}
      consultorios={sedeContext.consultorios}
      currentConsultorioId={sedeContext.currentConsultorioId}
      currentConsultorioName={sedeContext.currentConsultorioName}
      editable={!readOnly && !assistantView}
    />
  ) : null;

  return (
    <ResumenPanel
      patient={patient}
      activeDiagnosis={activeDiagnosis}
      clinicalSummary={clinicalSummary}
      sedeCard={sedeCard}
      overviewCard={<PatientOverviewCard data={overview} />}
      consentCard={assistantView ? null : <ConsentCard patientId={id} consent={consentData} desktop={isDesktopEdition()} />}
      reminderCard={reminderCard}
      notesCard={notesCard}
      clinicalAccess={!assistantView}
      readOnly={readOnly}
    />
  );
}
