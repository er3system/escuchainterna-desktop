import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  inTransaction: false,
  transaction: vi.fn(),
  register: vi.fn(),
  requestEmailVerification: vi.fn(),
  createSession: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/navigation', () => ({ redirect: harness.redirect }));
vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: vi.fn(() => ({ transaction: harness.transaction })),
}));
vi.mock('@/contexts/identity/infrastructure/createIdentityUseCases', () => ({
  createIdentityUseCases: vi.fn(() => ({
    registerPractitioner: { register: harness.register },
    requestEmailVerification: { request: harness.requestEmailVerification },
  })),
}));
vi.mock('@/shared/infrastructure/auth/session', () => ({ createSession: harness.createSession }));
vi.mock('@/shared/infrastructure/config/appBaseUrl', () => ({
  getAppBaseUrl: vi.fn(() => 'https://escuchainterna.test'),
}));

import { registerAction } from '@/app/registro/actions';

function validRegistration(): FormData {
  const formData = new FormData();
  formData.set('nombre', 'Ana Profesional');
  formData.set('email', 'ana@example.com');
  formData.set('password', 'NubeSegura2026!');
  formData.set('lada', '+52');
  formData.set('telefono', '5512345678');
  formData.set('terminos', 'on');
  return formData;
}

describe('registro público atómico', () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '0');
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
    harness.register.mockImplementation(async () => {
      expect(harness.inTransaction).toBe(true);
      return 'user-registered';
    });
    harness.requestEmailVerification.mockImplementation(async () => {
      expect(harness.inTransaction).toBe(false);
    });
    harness.createSession.mockResolvedValue(undefined);
  });

  it('ejecuta el caso de uso dentro de una sola transacción y deja el correo fuera', async () => {
    await registerAction({}, validRegistration());

    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.register).toHaveBeenCalledOnce();
    expect(harness.requestEmailVerification).toHaveBeenCalledWith(
      'user-registered',
      'https://escuchainterna.test',
    );
    expect(harness.createSession).toHaveBeenCalledWith('user-registered');
    expect(harness.redirect).toHaveBeenCalledWith('/onboarding');
  });

  it('no crea sesión ni envía verificación cuando falla el alta transaccional', async () => {
    harness.register.mockRejectedValueOnce(new Error('falló el alta'));

    const result = await registerAction({}, validRegistration());

    expect(result).toEqual({ error: 'falló el alta' });
    expect(harness.requestEmailVerification).not.toHaveBeenCalled();
    expect(harness.createSession).not.toHaveBeenCalled();
    expect(harness.redirect).not.toHaveBeenCalled();
  });

  it('crea sesión local sin solicitar verificación por correo en la edición PC', async () => {
    vi.stubEnv('ESCUCHAINTERNA_DESKTOP', '1');
    const form = validRegistration();
    form.set('ref', 'REFERIDO');
    await registerAction({}, form);

    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.register.mock.calls[0][0].referralCode()).toBeNull();
    expect(harness.requestEmailVerification).not.toHaveBeenCalled();
    expect(harness.createSession).toHaveBeenCalledWith('user-registered');
  });
});
