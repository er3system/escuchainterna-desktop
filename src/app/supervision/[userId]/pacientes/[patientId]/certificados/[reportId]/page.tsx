import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { requireSupervisor, requireSupervisionLink, requireSupervisedPatient } from '../../../../../supervisionData';
import { ReportEditor } from '@/app/(app)/pacientes/[id]/exportar/reportes/[reportId]/ReportEditor';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default async function CertificadoSupervisionPage({
  params,
}: {
  params: Promise<{ userId: string; patientId: string; reportId: string }>;
}) {
  const { userId: supervisorId } = await requireSupervisor();
  const { userId, patientId, reportId } = await params;
  // Gate: vínculo vigente + supervisado activo + paciente del supervisado (404 si no).
  const link = await requireSupervisionLink(supervisorId, userId);
  const patient = await requireSupervisedPatient(userId, patientId);

  // El certificado es PROPIEDAD del docente (owner = supervisor en sesión).
  const report = await new SqlitePatientReportRepository(supervisorId).findById(reportId);
  if (!report || !report.belongsTo(patientId)) notFound();

  // Traza del acto de emitir/editar el certificado sobre el paciente del supervisado.
  await logRecordAccess(supervisorId, patientId, 'supervision', 'certificado');

  const identity = await new SqliteProfessionalIdentityReader(supervisorId).read();
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 print:hidden">
        <Link
          href={`/supervision/${userId}/pacientes/${patientId}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline dark:text-accent-2"
        >
          <ArrowLeft size={16} /> Volver al paciente de {link.supervisedName}
        </Link>
      </div>
      <p className="mb-4 rounded-card border border-primary/30 bg-primary-light/30 px-4 py-2.5 text-sm text-ink print:hidden dark:border-accent-2/25 dark:bg-primary/15">
        Este certificado es <strong>tu</strong> documento sobre {patient.fullName}: lo firmas con tu
        tarjeta profesional. No se emite a nombre de {link.supervisedName}.
      </p>
      <ReportEditor
        report={report.toPrimitives()}
        patientId={patientId}
        patientName={patient.fullName}
        professional={professional}
        desktopEdition={isDesktopEdition()}
      />
    </div>
  );
}
