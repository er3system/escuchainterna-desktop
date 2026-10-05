import { PageHeader } from '@/components/ui';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { requireClinicalConfigAccess } from '@/shared/infrastructure/auth/dataOwner';
import { AgendaForm } from '../AgendaForm';
import type { AgendaFormGlobals, AgendaFormInitial } from '../AgendaForm';

export default async function NuevaAgendaPage() {
  const ownerUserId = await requireClinicalConfigAccess();
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
    name: '',
    color: '#5B5BD6',
    slug: '',
    durationMinutes: 60,
    slotIntervalMinutes: 60,
    minBookingHours: 8,
    bufferMinutes: 0,
    availabilityOverride: null,
    paymentOverride: null,
    locationOverride: null,
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nueva agenda"
        subtitle="Define el tipo de sesión: duración, color y, si lo necesitas, valores propios de disponibilidad, pago y ubicación."
      />
      <AgendaForm initial={initial} globals={globals} />
    </div>
  );
}
