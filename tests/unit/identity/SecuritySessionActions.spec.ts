import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  transaction: vi.fn(async (operation: () => Promise<unknown> | unknown) => operation()),
  changePassword: vi.fn(),
  bumpSessionEpoch: vi.fn(),
  createSession: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/contexts/identity/infrastructure/createIdentityUseCases', () => ({
  createIdentityUseCases: () => ({
    changePassword: { change: harness.changePassword },
  }),
}));

vi.mock('@/shared/infrastructure/auth/session', () => ({
  requireSessionUserId: vi.fn().mockResolvedValue('user-security'),
  bumpSessionEpoch: harness.bumpSessionEpoch,
  createSession: harness.createSession,
}));

vi.mock('@/shared/infrastructure/auth/totp', () => ({
  beginTotpSetup: vi.fn(),
  confirmTotpSetup: vi.fn(),
  disableTotp: vi.fn(),
}));

vi.mock('@/shared/infrastructure/persistence/SqliteAdapter', () => ({
  getDatabaseAdapter: () => ({ transaction: harness.transaction }),
}));

vi.mock('next/cache', () => ({ revalidatePath: harness.revalidatePath }));

import { changePasswordAction } from '@/app/(app)/configuracion/seguridad/passwordActions';
import { closeOtherSessionsAction } from '@/app/(app)/configuracion/seguridad/actions';

function passwordForm(): FormData {
  const formData = new FormData();
  formData.set('actual', 'Anterior#2026');
  formData.set('nueva', 'Nueva#Segura2026');
  formData.set('confirmacion', 'Nueva#Segura2026');
  return formData;
}

describe('acciones de seguridad de sesión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.transaction.mockImplementation(async (operation) => operation());
    harness.changePassword.mockResolvedValue('user-security');
    harness.bumpSessionEpoch.mockResolvedValue(undefined);
    harness.createSession.mockResolvedValue(undefined);
  });

  it('confirma el hash y el epoch dentro de una misma transacción', async () => {
    const result = await changePasswordAction({}, passwordForm());

    expect(result).toEqual({ ok: true });
    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.changePassword).toHaveBeenCalledWith(
      'user-security',
      'Anterior#2026',
      'Nueva#Segura2026',
    );
    expect(harness.bumpSessionEpoch).toHaveBeenCalledWith('user-security');
    expect(harness.changePassword.mock.invocationCallOrder[0]).toBeLessThan(
      harness.bumpSessionEpoch.mock.invocationCallOrder[0],
    );
    expect(harness.createSession).toHaveBeenCalledWith('user-security');
  });

  it('informa con precisión si la cookie falla después de cambiar la contraseña', async () => {
    harness.createSession.mockRejectedValueOnce(new Error('cookie unavailable'));

    const result = await changePasswordAction({}, passwordForm());

    expect(result.error).toContain('La contraseña se cambió');
    expect(result.error).toContain('Vuelve a iniciar sesión');
  });

  it('no intenta renovar la cookie si la transacción de contraseña falla', async () => {
    harness.changePassword.mockRejectedValueOnce(new Error('Contraseña actual incorrecta'));

    const result = await changePasswordAction({}, passwordForm());

    expect(result).toEqual({ error: 'Contraseña actual incorrecta' });
    expect(harness.createSession).not.toHaveBeenCalled();
  });

  it('distingue un cierre confirmado de un fallo al renovar la sesión actual', async () => {
    harness.createSession.mockRejectedValueOnce(new Error('cookie unavailable'));

    const result = await closeOtherSessionsAction({}, new FormData());

    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.bumpSessionEpoch).toHaveBeenCalledWith('user-security');
    expect(result.error).toContain('Las demás sesiones se cerraron');
  });
});
