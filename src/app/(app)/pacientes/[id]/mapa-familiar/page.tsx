import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Network, Plus } from 'lucide-react';
import { ListFamilyMaps } from '@/contexts/clinical-records/application/list-family-maps/ListFamilyMaps';
import { SqliteFamilyMapRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqliteFamilyMapRepository';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { Button, Card, EmptyState } from '@/components/ui';
import { createFamilyMapAction } from './actions';
import { DeleteMapButton } from './DeleteMapButton';

export default async function MapaFamiliarPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerUserId = await requireSessionUserId();
  const { id } = await params;
  const maps = await new ListFamilyMaps(new SqliteFamilyMapRepository(ownerUserId)).execute(id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Mapas familiares</h2>
          <p className="text-sm text-ink-soft">
            Genogramas del paciente: miembros, vínculos y posiciones se guardan por mapa.
          </p>
        </div>
        <form action={createFamilyMapAction.bind(null, id)} className="flex items-center gap-2">
          <input
            type="text"
            name="title"
            placeholder="Título del nuevo mapa"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
          <Button type="submit">
            <Plus size={16} /> Nuevo mapa
          </Button>
        </form>
      </div>

      {maps.length === 0 ? (
        <EmptyState
          title="Sin mapas familiares"
          description="Crea el primer genograma para representar la estructura y los vínculos familiares del paciente."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {maps.map((map) => (
            <Card key={map.id} className="flex flex-col">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                  <Network size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{map.title}</p>
                  <p className="text-xs text-ink-soft">
                    {map.memberCount} {map.memberCount === 1 ? 'miembro' : 'miembros'} · {map.linkCount}{' '}
                    {map.linkCount === 1 ? 'vínculo' : 'vínculos'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    Actualizado el {format(new Date(map.updatedAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Link
                  href={`/pacientes/${id}/mapa-familiar/${map.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary hover:text-white"
                >
                  Abrir editor
                </Link>
                <DeleteMapButton mapId={map.id} patientId={id} mapTitle={map.title} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
