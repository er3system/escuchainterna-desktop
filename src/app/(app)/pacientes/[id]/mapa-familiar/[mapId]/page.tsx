import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { SqliteFamilyMapRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteFamilyMapRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { GenogramEditor } from './GenogramEditor';

export default async function GenogramaPage({
  params,
}: {
  params: Promise<{ id: string; mapId: string }>;
}) {
  const ownerUserId = await requireSessionUserId();
  const { id, mapId } = await params;
  const map = await new SqliteFamilyMapRepository(ownerUserId).findById(mapId);
  if (!map || !map.belongsTo(id)) notFound();
  const patient = await new SqlitePatientDirectory(ownerUserId).findSummary(id);
  if (!patient) notFound();
  const primitives = map.toPrimitives();

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/pacientes/${id}/mapa-familiar`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          <ArrowLeft size={16} /> Volver a mapas familiares
        </Link>
      </div>
      <GenogramEditor
        mapId={mapId}
        patientId={id}
        patientName={patient.fullName}
        initialTitle={primitives.title}
        initialData={primitives.data}
      />
    </div>
  );
}
