import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GraduationCap, ChevronRight, FileSignature, ShieldAlert } from 'lucide-react';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { PATIENT_REPORT_STATUS_LABELS } from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { SupervisionBanner } from './SupervisionBanner';
import {
  requireSupervisor,
  listSupervised,
  listSignatureRequestsForSupervisor,
  listHeldPatientsISupervised,
} from './supervisionData';
import { IssueCustodyCertificateButton } from './custodia/IssueCustodyCertificateButton';

export default async function SupervisionPage() {
  const { userId, context } = await requireSupervisor();
  const supervised = await listSupervised(userId);
  const signatureRequests = await listSignatureRequestsForSupervisor(userId);
  // Edge co-firma B: expedientes en custodia institucional que este docente supervisó.
  const heldPatients = context.organization?.id
    ? await listHeldPatientsISupervised(userId, context.organization.id)
    : [];
  const certsRepo = new SqlitePatientReportRepository(userId);
  const heldWithCerts = [];
  for (const patient of heldPatients) {
    const certificates = await certsRepo.listByPatient(patient.patientId);
    heldWithCerts.push({
      ...patient,
      certificates: certificates.map((report) => report.toPrimitives()),
    });
  }

  return (
    <div>
      <SupervisionBanner />
      <PageHeader
        title="Supervisión"
        subtitle="Profesionales a tu cargo. Puedes revisar su trabajo clínico según el alcance que definió la organización."
      />

      {signatureRequests.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <FileSignature size={16} className="text-primary" /> Solicitudes de firma
            <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-semibold text-primary">
              {signatureRequests.length}
            </span>
          </h2>
          <div className="space-y-2">
            {signatureRequests.map((request) => (
              <Link key={request.id} href={`/supervision/firmas/${request.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{request.reportTitle}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {request.requesterName} · paciente {request.patientName} ·{' '}
                        {format(new Date(request.createdAt), "d 'de' MMM", { locale: es })}
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-ink-soft" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {heldWithCerts.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
            <ShieldAlert size={16} className="text-warning" /> Expedientes en custodia que supervisaste
          </h2>
          <p className="mb-3 text-xs text-ink-soft">
            El estudiante que los atendía ya no está y la institución los retuvo. Puedes emitir tu
            propio certificado (firmado con tu tarjeta); tu acceso queda registrado.
          </p>
          <div className="space-y-2">
            {heldWithCerts.map((patient) => (
              <Card key={patient.patientId}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{patient.patientName}</p>
                  <IssueCustodyCertificateButton patientId={patient.patientId} />
                </div>
                {patient.certificates.length > 0 ? (
                  <div className="mt-2 space-y-1 border-t border-line pt-2">
                    {patient.certificates.map((certificate) => (
                      <Link
                        key={certificate.id}
                        href={`/supervision/custodia/${patient.patientId}/certificados/${certificate.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-xs text-ink hover:text-primary"
                      >
                        <span className="min-w-0 truncate font-medium">{certificate.title}</span>
                        <Badge tone={certificate.status === 'firmado' ? 'success' : 'neutral'}>
                          {PATIENT_REPORT_STATUS_LABELS[certificate.status]}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {supervised.length === 0 ? (
        <EmptyState
          title="Aún no tienes supervisados"
          description="El perfil maestro de tu organización es quien asigna los vínculos de supervisión."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {supervised.map((person) => (
            <Link key={person.userId} href={`/supervision/${person.userId}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                      <GraduationCap size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{person.fullName || person.email}</p>
                      <p className="truncate text-xs text-ink-soft">{person.email}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {person.patientCount} pacientes · {person.noteCount} notas · {person.recordCount}{' '}
                        historias
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {person.scope.notas ? <Badge tone="primary">Notas</Badge> : null}
                        {person.scope.historias ? <Badge tone="primary">Historias</Badge> : null}
                        {person.scope.pagos ? <Badge tone="warning">Pagos</Badge> : null}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-ink-soft" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
