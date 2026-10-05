import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { SqliteAgendaRepository } from '@/contexts/scheduling/infrastructure/persistence/SqliteAgendaRepository';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { AgendaForm } from '../AgendaForm';
import type { AgendaFormGlobals, AgendaFormInitial } from '../AgendaForm';

export default async function EditarAgendaPage({
  params,
}: {
  params: Promise<{ agendaId: string }>;
}) {
  const ownerUserId = await requireClinicalConfigAccess();
  const { agendaId } = await params;
  const agenda = await new SqliteAgendaRepository(ownerUserId).findById(agendaId);
  if (!agenda) notFound();

  const primitives = agenda.toPrimitives();
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);

  const globals: AgendaFormGlobals = {
    availability: profile?.availability ?? [],
    price: profile?.defaultPrice ?? 0,
    paymentMode: profile?.paymentMode ?? 'manual',
    showPrice: profile?.showPrice ?? true,
    modality: profile?.modality ?? 'ambas',
    address: profile?.address ?? '',
    mapsUrl: profile?.mapsUrl ?? '',
    currency: profile?.currency ?? 'MXN',
  };

  const initial: AgendaFormInitial = {
    id: primitives.id,
    name: primitives.name,
    color: primitives.color,
    slug: primitives.slug,
    durationMinutes: primitives.durationMinutes,
    slotIntervalMinutes: primitives.slotIntervalMinutes,
    minBookingHours: primitives.minBookingHours,
    bufferMinutes: primitives.bufferMinutes,
    availabilityOverride: primitives.availabilityOverride,
    paymentOverride: primitives.paymentOverride,
    locationOverride: primitives.locationOverride,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Editar agenda · ${primitives.name}`}
        subtitle={`Liga pública: /reservar/${primitives.slug}`}
      />
      <AgendaForm initial={initial} globals={globals} />
    </div>
  );
}
