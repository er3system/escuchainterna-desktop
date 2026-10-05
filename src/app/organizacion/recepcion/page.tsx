import { Headset } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireOrgMaster, getOrganization, listConsultorios, listReceptionists } from '../orgData';
import { ReceptionToggle } from './ReceptionToggle';
import { CreateReceptionForm } from './CreateReceptionForm';
import { ReceptionistCard } from './ReceptionistCard';

/**
 * Recepción multi-consultorio (consultorios-spec §5): el maestro habilita la feature,
 * crea cuentas de recepción y elige qué consultorios atiende cada una. La recepción
 * agenda para los profesionales de esos consultorios (eligiendo destino), nunca ve
 * expediente clínico. Esta pantalla es solo gestión; la recepción opera en /recepcion.
 */
export default async function OrgRecepcionPage() {
  const { organization } = await requireOrgMaster();
  const current = (await getOrganization(organization.id)) ?? organization;
  const consultorios = await listConsultorios(current.id);
  const receptionists = await listReceptionists(current.id);
  const enabled = current.receptionMultiConsultorio;

  return (
    <div>
      <PageHeader
        title="Recepción"
        subtitle="Una cuenta de recepción agenda citas para los profesionales de los consultorios que le asignes — eligiendo el profesional en cada cita. Nunca ve el expediente clínico."
      />

      {consultorios.length === 0 ? (
        <EmptyState
          title="Primero crea consultorios"
          description="La recepción atiende uno o varios consultorios. Crea al menos un consultorio en la pestaña Consultorios para poder habilitarla."
        />
      ) : (
        <div className="space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                  <Headset size={18} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-ink">Recepción multi-consultorio</h2>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    Habilítala para crear cuentas de recepción. Si la desactivas, las cuentas existentes
                    dejan de poder agendar (no se borran).
                  </p>
                </div>
              </div>
              <ReceptionToggle enabled={enabled} />
            </div>
          </Card>

          {enabled ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              <div className="space-y-3 lg:col-span-3">
                {receptionists.length === 0 ? (
                  <EmptyState
                    title="Sin cuentas de recepción"
                    description="Crea la primera con el formulario de la derecha. Elige los consultorios que podrá atender."
                  />
                ) : (
                  receptionists.map((reception) => (
                    <ReceptionistCard
                      key={reception.userId}
                      reception={reception}
                      consultorios={consultorios}
                    />
                  ))
                )}
              </div>
              <div className="lg:col-span-2">
                <Card>
                  <h2 className="mb-3 text-sm font-bold text-ink">Nueva recepción</h2>
                  <CreateReceptionForm consultorios={consultorios} />
                </Card>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
