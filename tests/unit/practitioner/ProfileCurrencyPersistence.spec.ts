import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PractitionerProfilePrimitives } from '@/contexts/practitioner/domain/repositories/PractitionerProfileRepository';

const harness = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  update: vi.fn(),
  revalidatePath: vi.fn(),
  canConfigurePayments: true,
}));

vi.mock('next/cache', () => ({ revalidatePath: harness.revalidatePath }));
vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  forbidAssistantRole: vi.fn().mockResolvedValue('user-profile-currency'),
  sessionCanConfigurePayments: vi.fn(async () => harness.canConfigurePayments),
}));
vi.mock('@/shared/infrastructure/files/getFileStorage', () => ({
  getFileStorage: vi.fn(() => ({ save: vi.fn() })),
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

import { updateProfileAction } from '@/app/(app)/configuracion/perfil/actions';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';

const PROFILE: PractitionerProfilePrimitives = {
  id: 'profile-currency',
  userId: 'user-profile-currency',
  fullName: 'Profesional',
  phone: '',
  phoneCountryCode: '+57',
  description: '',
  photoPath: null,
  publicSlug: 'profesional',
  modality: 'ambas',
  address: '',
  mapsUrl: '',
  currency: 'MXN',
  defaultPrice: 800,
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

function profileForm(currency: string): FormData {
  const formData = new FormData();
  formData.set('nombre', PROFILE.fullName);
  formData.set('lada', PROFILE.phoneCountryCode);
  formData.set('moneda', currency);
  formData.set('precio', String(PROFILE.defaultPrice));
  formData.set('modalidad', PROFILE.modality);
  formData.set('modo_pago', PROFILE.paymentMode);
  formData.set('mostrar_precio', '1');
  formData.set('disponibilidad', '[]');
  return formData;
}

describe('guardar la moneda del perfil (regresión visual React 19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.findByUserId.mockResolvedValue(PROFILE);
    harness.update.mockResolvedValue(undefined);
    harness.canConfigurePayments = true;
  });

  it('persiste COP y revalida la página de perfil', async () => {
    const result = await updateProfileAction({}, profileForm('COP'));

    expect(harness.update).toHaveBeenCalledWith(expect.objectContaining({ currency: 'COP' }));
    expect(harness.revalidatePath).toHaveBeenCalledWith('/configuracion/perfil');
    expect(result).toEqual({ ok: '¡Se ha guardado exitosamente!' });
  });

  it('evita el submit nativo antes de despachar la acción, para que React no resetee el select', () => {
    const preventDefault = vi.fn();
    const submit = vi.fn();

    submitFormWithoutNativeReset({ preventDefault }, submit);

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(submit).toHaveBeenCalledOnce();
    expect(preventDefault.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0]);
  });

  it('preserva tarifas y políticas cuando la membresía no permite configurarlas', async () => {
    harness.canConfigurePayments = false;
    const formData = profileForm('COP');
    formData.set('precio', '1');
    formData.set('modo_pago', 'requerido');
    formData.set('politicas', 'cambio no autorizado');
    formData.delete('mostrar_precio');
    formData.set('tarifa_inasistencia_activa', '1');
    formData.set('tarifa_inasistencia_monto', '999');

    await updateProfileAction({}, formData);

    expect(harness.update).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: PROFILE.currency,
        defaultPrice: PROFILE.defaultPrice,
        paymentMode: PROFILE.paymentMode,
        showPrice: PROFILE.showPrice,
        paymentPolicies: PROFILE.paymentPolicies,
        noShowFeeEnabled: PROFILE.noShowFeeEnabled,
        noShowFeeAmount: PROFILE.noShowFeeAmount,
      }),
    );
  });
});
