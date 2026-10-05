import Link from 'next/link';
import { ArrowLeft, ChevronRight, User } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { SupervisionBanner } from '../SupervisionBanner';
import {
  requireSupervisor,
  requireSupervisionLink,
  listSupervisedPatients,
} from '../supervisionData';

export default async function SupervisedDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: supervisorId } = await requireSupervisor();
  const { userId } = await params;
  const link = await requireSupervisionLink(supervisorId, userId);
  const patients = await listSupervisedPatients(userId);

  return (
    <div>
      <SupervisionBanner detail={`Pacientes de ${link.supervisedName}`} />
      <div className="mb-4">
        <Link
          href="/supervision"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a supervisados
        </Link>
      </div>
      <PageHeader
        title={link.supervisedName}
        subtitle={`${patients.length} pacientes activos. Entra a un paciente para revisar su trabajo clínico.`}
      />

      {patients.length === 0 ? (
        <EmptyState
          title="Sin pacientes activos"
          description="Este profesional aún no tiene pacientes activos registrados."
        />
      ) : (
        <div className="space-y-3">
          {patients.map((patient) => (
            <Link key={patient.id} href={`/supervision/${userId}/pacientes/${patient.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                      <User size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-ink">{patient.fullName}</p>
                        {patient.activeDiagnosis ? (
                          <Badge tone="primary">{patient.activeDiagnosis}</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-soft">
                        {patient.noteCount} notas · {patient.recordCount} historias
                        {patient.consultationReason ? ` · Motivo: ${patient.consultationReason}` : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-ink-soft" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
