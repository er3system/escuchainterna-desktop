import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  activate: vi.fn(),
  transaction: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: harness.redirect }));
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: () => 'es-CO' })),
}));
vi.mock('@/shared/infrastructure/auth/session', () => ({
  requireSessionUserId: vi.fn(async () => 'subscription-user'),
  destroySession: vi.fn(),
}));
vi.mock('@/shared/infrastructure/persistence/PlanCatalog', () => ({
  findPlan: vi.fn(async () => ({ prices: { COP: 79_000 } })),
}));
vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: vi.fn(() => ({ transaction: harness.transaction })),
}));
vi.mock('@/contexts/identity/infrastructure/createIdentityUseCases', () => ({
  createIdentityUseCases: vi.fn(() => ({
    activateSubscription: { activate: harness.activate },
    getSessionContext: { get: vi.fn(async () => null) },
  })),
}));

import { activateSubscriptionAction } from '@/app/suscripcion/actions';

function subscriptionForm(idempotencyKey?: string): FormData {
  const formData = new FormData();
  formData.set('plan', 'profesional');
  if (idempotencyKey !== undefined) formData.set('idempotencyKey', idempotencyKey);
  return formData;
}

describe('activación de suscripción · idempotencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.transaction.mockImplementation(async (fn: () => Promise<unknown>) => fn());
    harness.activate.mockResolvedValue(undefined);
  });

  it('rechaza una clave ausente antes de abrir la transacción', async () => {
    const result = await activateSubscriptionAction({}, subscriptionForm());

    expect(result.error).toContain('No se recibió la clave de seguridad');
    expect(harness.transaction).not.toHaveBeenCalled();
    expect(harness.activate).not.toHaveBeenCalled();
  });

  it('rechaza una clave de longitud inválida', async () => {
    const result = await activateSubscriptionAction({}, subscriptionForm('demasiado-corta'));

    expect(result.error).toContain('no es válida');
    expect(harness.transaction).not.toHaveBeenCalled();
  });

  it('propaga una clave válida dentro de la transacción del adaptador', async () => {
    const key = '550e8400-e29b-41d4-a716-446655440000';

    await activateSubscriptionAction({}, subscriptionForm(key));

    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.activate).toHaveBeenCalledWith(
      'subscription-user',
      expect.objectContaining({ idempotencyKey: key }),
    );
  });
});
