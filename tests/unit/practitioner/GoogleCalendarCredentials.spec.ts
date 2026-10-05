import { describe, expect, it } from 'vitest';
import { IncompleteGoogleCalendarCredentialsError } from '@/contexts/practitioner/domain/errors/IncompleteGoogleCalendarCredentialsError';
import { GoogleCalendarCredentials } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarCredentials';
import {
  effectiveIntegrationStatus,
  integrationConfigurationRevision,
  type IntegrationConnection,
} from '@/app/(app)/configuracion/integraciones/integrationConnections';

describe('GoogleCalendarCredentials', () => {
  it('solo existe cuando ID y secreto están presentes', () => {
    expect(GoogleCalendarCredentials.create({})).toBeNull();
    expect(
      GoogleCalendarCredentials.create({
        client_id: 'calendar-client',
        client_secret: 'calendar-secret',
      })?.toPrimitives(),
    ).toEqual({ client_id: 'calendar-client', client_secret: 'calendar-secret' });
  });

  it.each([
    { client_id: 'calendar-client', client_secret: '' },
    { client_id: '', client_secret: 'calendar-secret' },
    { client_id: '   ', client_secret: 'calendar-secret' },
  ])('rechaza el par incompleto %#', (config) => {
    expect(() => GoogleCalendarCredentials.create(config)).toThrow(
      IncompleteGoogleCalendarCredentialsError,
    );
  });
});

describe('estado y revisión de integraciones', () => {
  it('degrada a desconectado un Google Calendar legado con una sola credencial', () => {
    expect(
      effectiveIntegrationStatus('google_calendar', 'conectado', {
        client_id: 'calendar-client',
      }),
    ).toBe('desconectado');
    expect(
      effectiveIntegrationStatus('google_calendar', 'conectado', {
        client_id: 'calendar-client',
        client_secret: 'calendar-secret',
      }),
    ).toBe('conectado');
  });

  it('cambia la revisión al borrar credenciales sin incluirlas en el key', () => {
    const configured: IntegrationConnection = {
      provider: 'google_calendar',
      status: 'conectado',
      config: { client_id: 'calendar-client', client_secret: 'calendar-secret' },
      connectedAt: '2026-07-22T12:00:00.000Z',
    };
    const disconnected: IntegrationConnection = {
      provider: 'google_calendar',
      status: 'desconectado',
      config: {},
      connectedAt: null,
    };

    const before = integrationConfigurationRevision(configured);
    const after = integrationConfigurationRevision(disconnected);

    expect(before).toMatch(/^[0-9a-f]{64}$/);
    expect(after).toMatch(/^[0-9a-f]{64}$/);
    expect(after).not.toBe(before);
    expect(before).not.toContain('calendar-client');
    expect(before).not.toContain('calendar-secret');
  });

  it('no deriva la revisión del valor de las credenciales', () => {
    const metadata = {
      provider: 'google_calendar' as const,
      status: 'conectado' as const,
      connectedAt: '2026-07-22T12:00:00.000Z',
    };
    const first = integrationConfigurationRevision({
      ...metadata,
      config: { client_id: 'client-one', client_secret: 'secret-one' },
    });
    const second = integrationConfigurationRevision({
      ...metadata,
      config: { client_id: 'client-two', client_secret: 'secret-two' },
    });

    expect(second).toBe(first);
  });
});
