import { EmptyState, PageHeader } from '@/components/ui';
import { requireReception } from '@/shared/infrastructure/auth/dataOwner';
import { listConsultoriosWithProfessionals } from './recepcionData';
import { ReceptionScheduler } from './ReceptionScheduler';

/**
 * Vista de la RECEPCIÓN multi-consultorio (consultorios-spec §5). Lista los consultorios
 * que atiende y sus profesionales, y permite AGENDAR para cada profesional (eligiendo el
 * destino; la cita queda a nombre del profesional). La recepción nunca ve expediente
 * clínico.
 */
export default async function RecepcionPage() {
  const { organizationId, consultorioIds } = await requireReception();
  const groups = await listConsultoriosWithProfessionals(organizationId, consultorioIds);
  const totalProfessionals = groups.reduce((sum, group) => sum + group.professionals.length, 0);

  return (
    <div>
      <PageHeader
        title="Recepción"
        subtitle="Agenda citas para los profesionales de tus consultorios. Eliges el profesional en cada cita; no ves el expediente clínico."
      />

      {groups.length === 0 ? (
        <EmptyState
          title="Sin consultorios asignados"
          description="Pídele al administrador de la organización que te asigne uno o varios consultorios para empezar a agendar."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-soft">
            Atiendes {groups.length} {groups.length === 1 ? 'consultorio' : 'consultorios'} ·{' '}
            {totalProfessionals} {totalProfessionals === 1 ? 'profesional' : 'profesionales'}.
          </p>
          <ReceptionScheduler groups={groups} />
        </div>
      )}
    </div>
  );
}
