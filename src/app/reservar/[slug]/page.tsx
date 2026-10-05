import { notFound } from 'next/navigation';
import { createSchedulingUseCases } from '@/contexts/scheduling/infrastructure/createSchedulingUseCases';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { resolveOwnerByPublicSlug } from '@/contexts/identity/infrastructure/persistence/SqlitePublicSlugResolver';
import { ownerHasFreeService } from '@/contexts/identity/infrastructure/persistence/SqliteFreeServiceReader';
import {
  ownerCanActuallyCharge,
  ownerHasActiveAppAccess,
} from '@/shared/infrastructure/auth/dataOwner';
import { BookingWizard } from './BookingWizard';
import type { PublicSessionType } from './BookingWizard';

export default async function ReservarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const normalizedSlug = slug.trim().toLowerCase();

  // Página pública: el dueño de los datos se resuelve desde el slug (perfil o agenda).
  const ownerUserId = await resolveOwnerByPublicSlug(normalizedSlug);
  if (!ownerUserId) notFound();
  if (!(await ownerHasActiveAppAccess(ownerUserId))) notFound();

  const profile = await new SqlitePractitionerProfileRepository().findByUserId(ownerUserId);
  const agendas = (await createSchedulingUseCases(ownerUserId).listAgendas.list()).filter(
    (agenda) => agenda.active,
  );

  // v3 §3 (universidades): si el dueño pertenece a una organización con
  // servicio sin costo, la página pública no muestra precios ni botón de pago.
  const freeService = await ownerHasFreeService(ownerUserId);
  const paymentsUnavailable = freeService || !(await ownerCanActuallyCharge(ownerUserId));

  const defaultModality = (profile?.modality ?? 'ambas') as PublicSessionType['modality'];

  const sessionTypes: PublicSessionType[] = agendas.map((agenda) => ({
    id: agenda.id,
    slug: agenda.slug,
    name: agenda.name,
    color: agenda.color,
    durationMinutes: agenda.durationMinutes,
    price: paymentsUnavailable ? 0 : (agenda.paymentOverride?.price ?? profile?.defaultPrice ?? 0),
    // Moneda efectiva de la agenda: override ('' = perfil) o la del perfil.
    currency: agenda.paymentOverride?.currency || (profile?.currency ?? 'MXN'),
    showPrice: paymentsUnavailable ? false : (agenda.paymentOverride?.showPrice ?? profile?.showPrice ?? true),
    modality: agenda.locationOverride?.modality ?? defaultModality,
    address: agenda.locationOverride?.address || (profile?.address ?? ''),
    mapsUrl: agenda.locationOverride?.mapsUrl || (profile?.mapsUrl ?? ''),
    minBookingHours: agenda.minBookingHours,
  }));

  const isProfileSlug = Boolean(profile && profile.publicSlug === normalizedSlug);
  const directAgenda = sessionTypes.find((sessionType) => sessionType.slug === normalizedSlug) ?? null;

  if (!isProfileSlug && !directAgenda) notFound();
  if (sessionTypes.length === 0) notFound();

  const practitioner = {
    name: profile?.fullName || 'Profesional de la salud mental',
    description: profile?.description ?? '',
    hasPhoto: Boolean(profile?.photoPath),
  };

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <p className="text-lg font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <BookingWizard
          practitioner={practitioner}
          sessionTypes={sessionTypes}
          preselectedId={directAgenda?.id ?? null}
          paymentPolicies={paymentsUnavailable ? '' : (profile?.paymentPolicies ?? '')}
          freeService={paymentsUnavailable}
        />
      </main>
      <footer className="pb-8 text-center text-xs text-ink-soft">
        Agenda en línea de {practitioner.name} · EscuchaInterna
      </footer>
    </div>
  );
}
