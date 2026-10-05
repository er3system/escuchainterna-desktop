import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { requireSupervisor, requireHeldPatientForCertification } from '../../../../supervisionData';
import { ReportEditor } from '@/app/(app)/pacientes/[id]/exportar/reportes/[reportId]/ReportEditor';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default async function CertificadoCustodiaPage({
  params,
}: {
  params: Promise<{ patientId: string; reportId: string }>;
}) {
  const { userId: supervisorId, context } = await requireSupervisor();
  const { patientId, reportId } = await params;
  const organizationId = context.organization?.id;
  if (!organizationId) notFound();
  // Gate de custodia: paciente retenido por la institución + el docente lo supervisó.
  const patient = await requireHeldPatientForCertification(supervisorId, organizationId, patientId);

  // El certificado es PROPIEDAD del docente (owner = supervisor en sesión).
  const report = await new SqlitePatientReportRepository(supervisorId).findById(reportId);
  if (!report || !report.belongsTo(patientId)) notFound();

  // Ruptura de cristal: acceso del docente a un expediente en custodia institucional.
  await logRecordAccess(supervisorId, patientId, 'supervision', 'acceso_cobertura');

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
          href="/supervision"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a Supervisión
        </Link>
      </div>
      <div className="mb-4 flex items-start gap-2 rounded-card border border-warning/40 bg-warning-soft px-4 py-2.5 text-sm text-ink print:hidden">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" />
        <p>
          Expediente <strong>en custodia de la institución</strong> (el estudiante que lo atendía ya
          no está). Tu acceso queda registrado. Este certificado es <strong>tu</strong> documento
          sobre {patient.patientName} y lo firmas con tu tarjeta profesional.
        </p>
      </div>
      <ReportEditor
        report={report.toPrimitives()}
        patientId={patientId}
        patientName={patient.patientName}
        professional={professional}
        desktopEdition={isDesktopEdition()}
      />
    </div>
  );
}
