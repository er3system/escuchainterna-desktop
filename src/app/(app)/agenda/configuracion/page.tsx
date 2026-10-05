import Link from 'next/link';
import { ArrowLeft, Clock3, Plus } from 'lucide-react';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { formatMoney } from '../agendaTypes';
import { AgendaRowActions, CopyLinkButton } from './AgendaListItemActions';

export default async function AgendaConfiguracionPage() {
  const ownerUserId = await requireClinicalConfigAccess();
  const agendas = await createSchedulingUseCases(ownerUserId).listAgendas.list();
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);
  const currency = profile?.currency ?? 'MXN';
  const defaultPrice = profile?.defaultPrice ?? 0;

  return (
    <div>
      <PageHeader
        title="Configurar agendas"
        subtitle="Cada agenda es un tipo de sesión reservable con su liga pública."
        actions={
          <>
            <Link
              href="/agenda"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink transition hover:bg-bg"
            >
              <ArrowLeft size={15} /> Volver a la agenda
            </Link>
            <Link
              href="/agenda/configuracion/nueva"
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              <Plus size={15} /> Nueva agenda
            </Link>
          </>
        }
      />

      {agendas.length === 0 ? (
        <EmptyState
          title="Sin agendas"
          description="Crea tu primera agenda (tipo de sesión) para empezar a recibir reservaciones."
          action={
            <Link
              href="/agenda/configuracion/nueva"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
            >
              + Nueva agenda
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {agendas.map((agenda) => (
            <div
              key={agenda.id}
              className="rounded-card border border-line bg-surface p-5 shadow-card"
              style={{ borderTopColor: agenda.color, borderTopWidth: 3 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: agenda.color }}
                  />
                  <div>
                    <p className="text-base font-bold text-ink">{agenda.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
                      <Clock3 size={13} /> {agenda.durationMinutes} min ·{' '}
                      {formatMoney(
                        agenda.paymentOverride?.price ?? defaultPrice,
                        agenda.paymentOverride?.currency || currency,
                      )}
                    </p>
                  </div>
                </div>
                {agenda.active ? (
                  <Badge tone="success">• Activa</Badge>
                ) : (
                  <Badge tone="neutral">Inactiva</Badge>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-bg px-3 py-2">
                <span className="truncate text-sm font-medium text-primary">{agenda.publicLink}</span>
                <CopyLinkButton path={agenda.publicLink} />
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-ink-soft">
                <span className="rounded-full bg-bg px-2 py-0.5">
                  {agenda.availabilityOverride ? 'Disponibilidad propia' : 'Disponibilidad global'}
                </span>
                <span className="rounded-full bg-bg px-2 py-0.5">
                  {agenda.paymentOverride ? 'Pago propio' : 'Pago global'}
                </span>
                <span className="rounded-full bg-bg px-2 py-0.5">
                  {agenda.locationOverride ? 'Ubicación propia' : 'Ubicación global'}
                </span>
                <span className="rounded-full bg-bg px-2 py-0.5">
                  Mínimo {agenda.minBookingHours} h para agendar
                </span>
              </div>

              <div className="mt-4 border-t border-line pt-3">
                <AgendaRowActions agendaId={agenda.id} active={agenda.active} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
