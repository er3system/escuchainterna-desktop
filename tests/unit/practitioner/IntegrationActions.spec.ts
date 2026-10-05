import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  saveIntegrationCredentials: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: harness.revalidatePath }));
vi.mock('@/shared/infrastructure/auth/dataOwner', () => ({
  requireClinicalConfigAccess: vi.fn().mockResolvedValue('owner-integrations'),
  requirePaymentConfigurationAccess: vi.fn().mockResolvedValue('owner-integrations'),
}));
vi.mock('@/app/(app)/configuracion/integraciones/integrationConnections', () => ({
  isIntegrationProvider: (provider: string) => provider === 'google_calendar',
  saveIntegrationCredentials: harness.saveIntegrationCredentials,
}));

import { saveIntegrationAction } from '@/app/(app)/configuracion/integraciones/actions';

function googleCalendarForm(clientId: string, clientSecret: string): FormData {
  const formData = new FormData();
  formData.set('provider', 'google_calendar');
  formData.set('config_client_id', clientId);
  formData.set('config_client_secret', clientSecret);
  return formData;
}

describe('saveIntegrationAction (Google Calendar)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.saveIntegrationCredentials.mockResolvedValue('conectado');
  });

  it.each([
    ['calendar-client', ''],
    ['', 'calendar-secret'],
  ])('propaga la validación del merge servidor cuando falta una credencial', async (clientId, clientSecret) => {
    harness.saveIntegrationCredentials.mockRejectedValueOnce(
      new Error('Google Calendar requiere tanto el ID de cliente como el secreto de cliente.'),
    );
    const result = await saveIntegrationAction({}, googleCalendarForm(clientId, clientSecret));

    expect(result).toEqual({
      error: 'Google Calendar requiere tanto el ID de cliente como el secreto de cliente.',
    });
    expect(harness.saveIntegrationCredentials).toHaveBeenCalledTimes(1);
    expect(harness.saveIntegrationCredentials).toHaveBeenCalledWith(
      'google_calendar',
      clientSecret
        ? { client_id: clientId, client_secret: clientSecret }
        : { client_id: clientId },
      'owner-integrations',
    );
    expect(harness.revalidatePath).not.toHaveBeenCalled();
  });

  it('guarda y marca conectado cuando el par está completo', async () => {
    const result = await saveIntegrationAction(
      {},
      googleCalendarForm('  calendar-client  ', '  calendar-secret  '),
    );

    expect(harness.saveIntegrationCredentials).toHaveBeenCalledWith(
      'google_calendar',
      { client_id: 'calendar-client', client_secret: 'calendar-secret' },
      'owner-integrations',
    );
    expect(harness.revalidatePath).toHaveBeenCalledWith('/configuracion/integraciones');
    expect(result).toEqual({
      ok: 'Credenciales guardadas localmente. Integración marcada como conectada.',
    });
  });
});
