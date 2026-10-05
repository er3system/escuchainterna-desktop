import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PractitionerProfilePrimitives } from '@/contexts/practitioner/domain/repositories/PractitionerProfileRepository';

const harness = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: harness.revalidatePath }));
vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  requireClinicalConfigAccess: vi.fn().mockResolvedValue('user-reminders'),
}));
vi.mock(
  '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository',
  () => ({
    SqlitePractitionerProfileRepository: class {
      public async findByUserId(userId: string): Promise<PractitionerProfilePrimitives | null> {
        return harness.findByUserId(userId);
      }

      public async update(profile: PractitionerProfilePrimitives): Promise<void> {
        await harness.update(profile);
      }
    },
  }),
);

import { updateRemindersAction } from '@/app/(app)/configuracion/recordatorios/actions';

const PROFILE: PractitionerProfilePrimitives = {
  id: 'profile-reminders',
  userId: 'user-reminders',
  fullName: 'Profesional',
  phone: '',
  phoneCountryCode: '+57',
  description: '',
  photoPath: null,
  publicSlug: 'profesional',
  modality: 'ambas',
  address: '',
  mapsUrl: '',
  currency: 'COP',
  defaultPrice: 150_000,
  paymentMode: 'manual',
  showPrice: true,
  paymentPolicies: '',
  availability: [],
  sessionReminderHours: 24,
  cancellationMinHours: 24,
  autoPaymentReminders: false,
  onboardingCompleted: true,
  professionalLicense: '',
  contactAddress: '',
  contactPhone: '',
  noShowFeeEnabled: false,
  noShowFeeAmount: 0,
  lateCancelFeeEnabled: false,
  lateCancelFeeAmount: 0,
  emailTheme: 'calido',
};

describe('guardar configuración de recordatorios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.findByUserId.mockResolvedValue(PROFILE);
    harness.update.mockResolvedValue(undefined);
  });

  it('persiste anticipación, cancelación y recordatorios de pago juntos', async () => {
    const formData = new FormData();
    formData.set('anticipacion', '36');
    formData.set('cancelacion', '48');
    formData.set('recordatorios_pago', '1');

    const result = await updateRemindersAction({}, formData);

    expect(harness.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionReminderHours: 36,
        cancellationMinHours: 48,
        autoPaymentReminders: true,
      }),
    );
    expect(harness.revalidatePath).toHaveBeenCalledWith('/configuracion/recordatorios');
    expect(result.ok).toBeTruthy();
  });

  it('conserva los valores persistidos cuando recibe opciones fuera del catálogo', async () => {
    const formData = new FormData();
    formData.set('anticipacion', '13');
    formData.set('cancelacion', '7');

    await updateRemindersAction({}, formData);

    expect(harness.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionReminderHours: 24,
        cancellationMinHours: 24,
        autoPaymentReminders: false,
      }),
    );
  });
});
