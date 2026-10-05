import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { SqliteClinicalRecordRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteClinicalRecordRepository';
import { SqliteSessionNoteRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteSessionNoteRepository';
import { SqliteDiagnosisRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteDiagnosisRepository';
import { GetExpedienteGaps } from '@/contexts/clinical-records/application/get-expediente-gaps/GetExpedienteGaps';
import { SqliteMySupervisorsReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteMySupervisorsReader';
import { SqliteReportSignatureRequestRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteReportSignatureRequestRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { ReportEditor } from './ReportEditor';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default async function ReporteFirmablePage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id, reportId } = await params;

  const report = await new SqlitePatientReportRepository(ownerUserId).findById(reportId);
  if (!report || !report.belongsTo(id)) notFound();
  const patient = await new SqlitePatientDirectory(ownerUserId).findSummary(id);
  if (!patient) notFound();

  // Checklist "Antes de firmar" (huecos del expediente) — recordatorio de UI,
  // fuera del documento firmable.
  const gaps = await new GetExpedienteGaps({
    patients: new SqlitePatientDirectory(ownerUserId),
    records: new SqliteClinicalRecordRepository(ownerUserId),
    notes: new SqliteSessionNoteRepository(ownerUserId),
    diagnoses: new SqliteDiagnosisRepository(ownerUserId),
    identity: new SqliteProfessionalIdentityReader(ownerUserId),
  }).execute(id);

  const identity = await new SqliteProfessionalIdentityReader(ownerUserId).read();
  const professional = identity
    ? {
        fullName: identity.fullName,
        professionalLicense: identity.professionalLicense,
        email: identity.email,
        contactPhone: identity.contactPhone,
        contactAddress: identity.contactAddress,
        organizationName: identity.organizationName,
        organizationLogoDataUri: identity.organizationLogoDataUri,
      }
    : null;

  // Co-firma: si el practicante no tiene tarjeta, puede pedir la firma de su supervisor.
  const supervisors = (await new SqliteMySupervisorsReader().list(ownerUserId)).map((supervisor) => ({
    supervisorUserId: supervisor.supervisorUserId,
    fullName: supervisor.fullName,
    email: supervisor.email,
  }));
  const pendingRequest = await new SqliteReportSignatureRequestRepository().findPendingByReport(reportId);
  const pendingRequestId =
    pendingRequest && pendingRequest.requestedBy(ownerUserId) ? pendingRequest.requestId() : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 print:hidden">
        <Link
          href={`/pacientes/${id}/exportar`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a Exportar
        </Link>
      </div>
      <ReportEditor
        report={report.toPrimitives()}
        patientId={id}
        patientName={patient.fullName}
        professional={professional}
        gaps={gaps}
        supervisors={supervisors}
        pendingRequestId={pendingRequestId}
        desktopEdition={isDesktopEdition()}
      />
    </div>
  );
}
