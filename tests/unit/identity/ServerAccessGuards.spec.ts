import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '@/contexts/identity/application/get-session-context/SessionContext';
import { PaymentConfigurationNotAllowedError } from '@/contexts/identity/domain/errors/PaymentConfigurationNotAllowedError';
import { PaymentsDisabledByMembershipError } from '@/contexts/identity/domain/errors/PaymentsDisabledByMembershipError';
import { PatientInInstitutionalCustodyIsReadOnlyError } from '@/contexts/patients/domain/errors/PatientInInstitutionalCustodyIsReadOnlyError';
import { PatientNotFoundError } from '@/contexts/patients/domain/errors/PatientNotFoundError';

const harness = vi.hoisted(() => ({
  sessionUserId: 'owner-1' as string | null,
  contexts: new Map<string, SessionContext>(),
  getContext: vi.fn(),
  custody: false,
  patientOwned: true,
  queryRow: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock('@/shared/infrastructure/auth/session', () => ({
  getSessionUserId: vi.fn(async () => harness.sessionUserId),
}));
vi.mock('@/contexts/identity/infrastructure/createIdentityUseCases', () => ({
  createIdentityUseCases: () => ({
    getSessionContext: {
      get: harness.getContext,
    },
  }),
}));
vi.mock('@/shared/infrastructure/auth/institutionalCustody', () => ({
  isInstitutionalCustody: vi.fn(async () => harness.custody),
}));
vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: vi.fn(() => ({ queryRow: harness.queryRow, query: vi.fn() })),
}));

import {
  getActiveAppSessionContext,
  ownerCanActuallyCharge,
  ownerHasActiveAppAccess,
  requireClinicalRecordAccessUserId,
  requireClinicalRecordWriteAccess,
  requireDataOwnerUserId,
  requirePaymentConfigurationAccess,
  requirePaymentModuleOwnerUserId,
  requirePaymentWriteOwnerUserId,
} from '@/shared/infrastructure/auth/dataOwner';

function context(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    userId: 'owner-1',
    email: 'owner@example.com',
    fullName: 'Owner',
    role: 'psychologist',
    status: 'activo',
    onboardingCompleted: true,
    organization: null,
    permissions: {
      canCharge: true,
      retentionPercent: 0,
      forceAppPayments: false,
      paymentsDisabled: false,
      canSupervisePatients: false,
      canConfigurePayments: true,
    },
    isSupervisor: false,
    isAssistant: false,
    isReception: false,
    dataOwnerUserId: 'owner-1',
    subscription: {
      plan: 'profesional',
      status: 'activa',
      trialEndsAt: '2026-01-01T00:00:00.000Z',
      currentPeriodEnd: null,
      canceledAt: null,
      expired: false,
      daysLeftInTrial: 0,
    },
    ...overrides,
  };
}

describe('guards server-side de acceso privado', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '0');
    vi.clearAllMocks();
    harness.sessionUserId = 'owner-1';
    harness.custody = false;
    harness.patientOwned = true;
    harness.contexts = new Map([['owner-1', context()]]);
    harness.getContext.mockImplementation(async (userId: string) => harness.contexts.get(userId) ?? null);
    harness.queryRow.mockImplementation(async () => (harness.patientOwned ? { id: 'patient-1' } : null));
  });

  it('replica el paywall en server actions cuando la suscripción venció', async () => {
    harness.contexts.set(
      'owner-1',
      context({ subscription: { ...context().subscription!, status: 'vencida', expired: true } }),
    );

    await expect(requireDataOwnerUserId()).rejects.toThrow('REDIRECT:/suscripcion');
    await expect(ownerHasActiveAppAccess('owner-1')).resolves.toBe(false);
    await expect(getActiveAppSessionContext()).resolves.toBeNull();
  });

  it('expone una variante nullable para assets sin redirecciones', async () => {
    await expect(getActiveAppSessionContext()).resolves.toMatchObject({ userId: 'owner-1' });

    harness.contexts.set('owner-1', context({ status: 'suspendido' }));
    await expect(getActiveAppSessionContext()).resolves.toBeNull();

    harness.sessionUserId = null;
    await expect(getActiveAppSessionContext()).resolves.toBeNull();
  });

  it('en PC no exige suscripción pero conserva la sesión, el estado y el dueño', async () => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
    harness.contexts.set('owner-1', context({ subscription: null }));
    await expect(requireDataOwnerUserId()).resolves.toBe('owner-1');
    await expect(ownerHasActiveAppAccess('owner-1')).resolves.toBe(true);

    harness.contexts.set('owner-1', context({ subscription: { ...context().subscription!, expired: true } }));
    await expect(getActiveAppSessionContext()).resolves.toMatchObject({ userId: 'owner-1' });
    await expect(requireDataOwnerUserId()).resolves.toBe('owner-1');

    harness.contexts.set('owner-1', context({ status: 'suspendido', subscription: null }));
    await expect(getActiveAppSessionContext()).resolves.toBeNull();
    await expect(ownerHasActiveAppAccess('owner-1')).resolves.toBe(false);
    harness.sessionUserId = null;
    await expect(requireDataOwnerUserId()).rejects.toThrow('REDIRECT:/login');
  });

  it('en PC sigue rechazando pacientes ajenos y restringiendo al rol asistente', async () => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
    harness.patientOwned = false;
    await expect(requireClinicalRecordWriteAccess('ajeno')).rejects.toBeInstanceOf(PatientNotFoundError);
    harness.contexts.set('owner-1', context({ role: 'assistant', isAssistant: true, dataOwnerUserId: 'professional-1', subscription: null }));
    await expect(requireDataOwnerUserId()).resolves.toBe('professional-1');
    await expect(requireClinicalRecordAccessUserId()).rejects.toThrow('REDIRECT:/pacientes?aviso=expediente');
  });

  it('el asistente no obtiene acceso clínico y un admin autorizado conserva acceso', async () => {
    harness.contexts.set(
      'owner-1',
      context({ role: 'assistant', isAssistant: true, dataOwnerUserId: 'professional-1' }),
    );
    await expect(requireClinicalRecordAccessUserId()).rejects.toThrow(
      'REDIRECT:/pacientes?aviso=expediente',
    );

    harness.contexts.set(
      'owner-1',
      context({ role: 'admin', subscription: null }),
    );
    await expect(requireClinicalRecordAccessUserId()).resolves.toBe('owner-1');
  });

  it('la custodia institucional permite lectura pero veta cualquier escritura clínica', async () => {
    harness.custody = true;

    await expect(requireClinicalRecordAccessUserId()).resolves.toBe('owner-1');
    await expect(requireClinicalRecordWriteAccess('patient-1')).rejects.toBeInstanceOf(
      PatientInInstitutionalCustodyIsReadOnlyError,
    );
  });

  it('falla cerrado para pacientes ajenos o inexistentes en escritura clínica y operativa', async () => {
    harness.patientOwned = false;

    await expect(requireClinicalRecordWriteAccess('patient-from-other-owner')).rejects.toBeInstanceOf(
      PatientNotFoundError,
    );
    const { requirePatientOperationalWriteContext } = await import(
      '@/shared/infrastructure/auth/dataOwner'
    );
    await expect(
      requirePatientOperationalWriteContext('missing-patient'),
    ).rejects.toBeInstanceOf(PatientNotFoundError);
  });

  it('distingue lectura, cobro y configuración con los permisos de membresía', async () => {
    harness.contexts.set(
      'owner-1',
      context({
        permissions: {
          ...context().permissions,
          canConfigurePayments: false,
        },
      }),
    );

    await expect(requirePaymentModuleOwnerUserId()).resolves.toBe('owner-1');
    await expect(requirePaymentWriteOwnerUserId()).resolves.toBe('owner-1');
    await expect(requirePaymentConfigurationAccess()).rejects.toBeInstanceOf(
      PaymentConfigurationNotAllowedError,
    );

    harness.contexts.set(
      'owner-1',
      context({
        permissions: {
          ...context().permissions,
          canCharge: false,
          paymentsDisabled: true,
        },
      }),
    );
    await expect(requirePaymentModuleOwnerUserId()).rejects.toBeInstanceOf(
      PaymentsDisabledByMembershipError,
    );
    await expect(requirePaymentWriteOwnerUserId()).rejects.toBeInstanceOf(
      PaymentsDisabledByMembershipError,
    );
    await expect(ownerCanActuallyCharge('owner-1')).resolves.toBe(false);
  });
});
