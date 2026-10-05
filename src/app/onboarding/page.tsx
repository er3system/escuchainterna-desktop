import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { ownerHasFreeService } from '@/contexts/identity/infrastructure/persistence/SqliteFreeServiceReader';
import { getIntegrationStatuses } from './localIntegrations';
import { OnboardingWizard } from './OnboardingWizard';
import { DEFAULT_PAYMENT_POLICIES } from './defaultPaymentPolicies';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

const DEFAULT_AVAILABILITY = [1, 2, 3, 4, 5].map((day) => ({
  day,
  ranges: [{ from: '09:00', to: '17:00' }],
}));

export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const repository = new SqlitePractitionerProfileRepository();
  let profile = await repository.findByUserId(userId);
  if (!profile) {
    await repository.createEmptyProfileFor(userId);
    profile = await repository.findByUserId(userId);
  }

  const integrationStatuses = await getIntegrationStatuses(userId);

  // v3 §3 (universidades): miembros de una organización con servicio sin
  // costo no configuran tarifas — el wizard salta el paso de pago.
  const skipPaymentStep = await ownerHasFreeService(userId);

  return (
    <OnboardingWizard
      skipPaymentStep={skipPaymentStep}
      desktopEdition={isDesktopEdition()}
      initial={{
        fullName: profile?.fullName ?? '',
        phone: profile?.phone ?? '',
        phoneCountryCode: profile?.phoneCountryCode || '+52',
        professionalLicense: profile?.professionalLicense ?? '',
        description: profile?.description ?? '',
        modality: profile?.modality ?? 'ambas',
        address: profile?.address ?? '',
        mapsUrl: profile?.mapsUrl ?? '',
        availability:
          profile && profile.availability.length > 0 ? profile.availability : DEFAULT_AVAILABILITY,
        defaultPrice: profile?.defaultPrice ?? 500,
        currency: profile?.currency || 'MXN',
        paymentMode: profile?.paymentMode ?? 'manual',
        showPrice: profile?.showPrice ?? true,
        paymentPolicies: profile?.paymentPolicies || DEFAULT_PAYMENT_POLICIES,
        noShowFeeEnabled: profile?.noShowFeeEnabled ?? false,
        noShowFeeAmount: profile?.noShowFeeAmount ?? 0,
        lateCancelFeeEnabled: profile?.lateCancelFeeEnabled ?? false,
        lateCancelFeeAmount: profile?.lateCancelFeeAmount ?? 0,
      }}
      integrationStatuses={integrationStatuses}
    />
  );
}
