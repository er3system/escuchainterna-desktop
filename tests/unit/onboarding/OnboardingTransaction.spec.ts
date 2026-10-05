import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PractitionerProfilePrimitives } from '@/contexts/practitioner/domain/repositories/PractitionerProfileRepository';

const harness = vi.hoisted(() => ({
  inTransaction: false,
  transaction: vi.fn(),
  findByUserId: vi.fn(),
  createEmptyProfileFor: vi.fn(),
  updateProfile: vi.fn(),
  listAgendas: vi.fn(),
  createAgenda: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: harness.revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: harness.redirect }));
vi.mock('@/shared/infrastructure/auth/session', () => ({
  getSessionUserId: vi.fn().mockResolvedValue('user-onboarding'),
}));
vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  requireClinicalConfigAccess: vi.fn().mockResolvedValue('user-onboarding'),
  requirePaymentConfigurationAccess: vi.fn().mockResolvedValue('user-onboarding'),
  sessionCanConfigurePayments: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: vi.fn(() => ({ transaction: harness.transaction })),
}));
vi.mock(
  '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository',
  () => ({
    SqlitePractitionerProfileRepository: class {
      public async findByUserId(userId: string): Promise<PractitionerProfilePrimitives | null> {
        return harness.findByUserId(userId);
      }

      public async createEmptyProfileFor(userId: string): Promise<void> {
        await harness.createEmptyProfileFor(userId);
      }

      public async update(profile: PractitionerProfilePrimitives): Promise<void> {
        await harness.updateProfile(profile);
      }
    },
  }),
);
vi.mock('@/contexts/scheduling/infrastructure/createSchedulingUseCases', () => ({
  createSchedulingUseCases: vi.fn(() => ({
    listAgendas: { list: harness.listAgendas },
    createAgenda: { create: harness.createAgenda },
  })),
}));
vi.mock('@/app/onboarding/localIntegrations', () => ({ markIntegrationSimulated: vi.fn() }));

import { finishOnboardingAction } from '@/app/onboarding/actions';
import type { OnboardingData } from '@/app/onboarding/actions';
import { DEFAULT_PAYMENT_POLICIES } from '@/app/onboarding/defaultPaymentPolicies';

const PROFILE: PractitionerProfilePrimitives = {
  id: 'profile-onboarding',
  userId: 'user-onboarding',
  fullName: '',
  phone: '',
  phoneCountryCode: '+52',
  description: '',
  photoPath: null,
  publicSlug: 'user-onboarding',
  modality: 'ambas',
  address: '',
  mapsUrl: '',
  currency: 'MXN',
  defaultPrice: 500,
  paymentMode: 'manual',
  showPrice: true,
  paymentPolicies: '',
  availability: [],
  sessionReminderHours: 24,
  cancellationMinHours: 24,
  autoPaymentReminders: false,
  onboardingCompleted: false,
  professionalLicense: '',
  contactAddress: '',
  contactPhone: '',
  noShowFeeEnabled: false,
  noShowFeeAmount: 0,
  lateCancelFeeEnabled: false,
  lateCancelFeeAmount: 0,
  emailTheme: 'calido',
};

const DATA: OnboardingData = {
  fullName: 'Ana Profesional',
  phone: '5512345678',
  phoneCountryCode: '+52',
  professionalLicense: 'ABC-123',
  description: 'Atención psicológica',
  modality: 'ambas',
  address: 'Consultorio central',
  mapsUrl: '',
  availability: [{ day: 1, ranges: [{ from: '09:00', to: '17:00' }] }],
  defaultPrice: 800,
  currency: 'MXN',
  paymentMode: 'manual',
  showPrice: true,
  paymentPolicies: DEFAULT_PAYMENT_POLICIES,
  noShowFeeEnabled: false,
  noShowFeeAmount: 0,
  lateCancelFeeEnabled: false,
  lateCancelFeeAmount: 0,
};

describe('onboarding atómico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.inTransaction = false;
    harness.transaction.mockImplementation(async (work: () => Promise<unknown>) => {
      harness.inTransaction = true;
      try {
        return await work();
      } finally {
        harness.inTransaction = false;
      }
    });
    harness.findByUserId.mockResolvedValue(PROFILE);
    harness.updateProfile.mockImplementation(async () => {
      expect(harness.inTransaction).toBe(true);
    });
    harness.listAgendas.mockImplementation(async () => {
      expect(harness.inTransaction).toBe(true);
      return [];
    });
    harness.createAgenda.mockImplementation(async () => {
      expect(harness.inTransaction).toBe(true);
    });
  });

  it('guarda perfil y agenda dentro de la misma transacción', async () => {
    await finishOnboardingAction(DATA);

    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ana Profesional', onboardingCompleted: true }),
    );
    expect(harness.createAgenda).toHaveBeenCalledOnce();
    expect(harness.revalidatePath).toHaveBeenCalledWith('/inicio');
    expect(harness.revalidatePath).toHaveBeenCalledWith('/agenda');
    expect(harness.redirect).toHaveBeenCalledWith('/inicio');
  });

  it('no navega al inicio cuando falla la creación de la agenda', async () => {
    harness.createAgenda.mockRejectedValueOnce(new Error('falló la agenda'));

    const result = await finishOnboardingAction(DATA);

    expect(result).toEqual({ ok: false, error: 'falló la agenda' });
    expect(harness.revalidatePath).not.toHaveBeenCalled();
    expect(harness.redirect).not.toHaveBeenCalled();
  });
});

describe('políticas de pago iniciales', () => {
  it('no incluyen una cuenta bancaria ficticia y usan texto neutral', () => {
    expect(DEFAULT_PAYMENT_POLICIES).not.toContain('000000000');
    expect(DEFAULT_PAYMENT_POLICIES).not.toContain('Cuenta:');
    expect(DEFAULT_PAYMENT_POLICIES).toContain('entre profesional y paciente');
  });
});
