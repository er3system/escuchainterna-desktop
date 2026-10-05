import { describe, expect, it, vi } from 'vitest';
import { UUID, Email } from '@haskou/value-objects';
import { createHash } from 'node:crypto';
import { HttpGoogleCalendarGateway } from '@/contexts/practitioner/infrastructure/google-calendar/HttpGoogleCalendarGateway';
import { GoogleCalendarGrant, GOOGLE_CALENDAR_SCOPES } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarGrant';
import { DesktopGoogleCalendarClient } from '@/contexts/practitioner/domain/value-objects/DesktopGoogleCalendarClient';
import { GoogleCalendarConnection } from '@/contexts/practitioner/domain/GoogleCalendarConnection';
import { GoogleCalendarReference } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarReference';
import { CalendarTimeWindow } from '@/contexts/practitioner/domain/value-objects/CalendarTimeWindow';
import { CalendarSessionSlot } from '@/contexts/practitioner/domain/CalendarSessionSlot';
const owner = new UUID('11111111-1111-4111-8111-111111111111'); const booking = new UUID('22222222-2222-4222-8222-222222222222');
const grant = GoogleCalendarGrant.create('private-access-fixture', 'private-refresh-fixture', Date.now() + 3600_000, GOOGLE_CALENDAR_SCOPES.join(' '));
const client = DesktopGoogleCalendarClient.create('12345678-fixture.apps.googleusercontent.com', 'private-secret-fixture');
const connection = new GoogleCalendarConnection(client, grant, new Email('fixture@example.test'), GoogleCalendarReference.create('fixture@group.calendar.google.com'));
const window = CalendarTimeWindow.create('2026-10-01', '2026-10-31'); const slot = new CalendarSessionSlot(booking, CalendarTimeWindow.create('2026-10-06T10:00Z', '2026-10-06T11:00Z'));
const marker = createHash('sha256').update(owner.toString()).digest('hex');
const id = `ei${createHash('sha256').update(`${owner.toString()}:${booking.toString()}`).digest('hex')}`;
const event = (eventId: string) => ({ id: eventId, extendedProperties: { private: { ei_owner: marker, ei_version: '1' } } });
const response = (body: unknown, status = 200): Response => status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status });
describe('adaptador Google Calendar', () => {
  it('envía PKCE al endpoint fijo sin secretos en URL ni redirecciones; conserva refresh_token al renovar', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(response({ token_type: 'Bearer', access_token: 'fresh-fixture', expires_in: 3600 })); const google = new HttpGoogleCalendarGateway(send);
    const renewed = await google.refresh(client, grant); expect(renewed.toPrimitives().refresh_token).toBe('private-refresh-fixture');
    expect(send.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token'); expect(send.mock.calls[0][1]?.redirect).toBe('error');
    send.mockResolvedValue(response({ token_type: 'Bearer', access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: GOOGLE_CALENDAR_SCOPES.join(' ') }));
    await google.exchange(client, 'private-code', 'http://127.0.0.1:5000/api/desktop/google-calendar/callback', 'fixture-verifier');
    expect(send.mock.calls[1][1]?.body).toContain('code_verifier=fixture-verifier');
  });
  it('no revela errores del proveedor, tokens ni excepción de red', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(response({ error_description: 'private-secret-fixture' }, 403)); const google = new HttpGoogleCalendarGateway(send);
    await expect(google.account(grant)).rejects.toThrow('Google rechazó');
    send.mockRejectedValue(new Error('private-access-fixture')); await expect(google.account(grant)).rejects.toThrow('Comprueba internet');
    send.mockResolvedValue(response({ access_token: 'a', expires_in: 3600, token_type: 'Bearer' })); await expect(google.exchange(client, 'code', 'redirect', 'verifier')).rejects.toThrow('renovable');
  });
  it('publica solo horarios privados, sin UUID locales ni datos de pacientes, y reutiliza IDs', async () => {
    const send = vi.fn<typeof fetch>().mockImplementation(async () => response({})); send.mockResolvedValueOnce(response({ items: [] })); const google = new HttpGoogleCalendarGateway(send);
    expect(await google.publish(owner, connection, [slot], window)).toEqual({ published: 1, removed: 0 });
    const request = send.mock.calls[1]; expect(request[1]?.method).toBe('POST'); const body = JSON.parse(String(request[1]?.body));
    expect(body).toEqual({ id, summary: 'Sesión de consulta', status: 'confirmed', start: { dateTime: '2026-10-06T10:00:00.000Z' }, end: { dateTime: '2026-10-06T11:00:00.000Z' }, visibility: 'private', transparency: 'opaque', reminders: { useDefault: false }, guestsCanInviteOthers: false, guestsCanSeeOtherGuests: false, extendedProperties: { private: { ei_owner: marker, ei_version: '1' } } });
    expect(String(request[1]?.body)).not.toContain(booking.toString()); expect(String(request[0])).not.toContain('private-access-fixture');
    send.mockClear(); send.mockResolvedValueOnce(response({ items: [event(id)] })); await google.publish(owner, connection, [slot], window); expect(send.mock.calls[1][1]?.method).toBe('PUT');
  });
  it('retira solo eventos gestionados por el dueño y conserva ajenos', async () => {
    const stale = `ei${'a'.repeat(64)}`; const send = vi.fn<typeof fetch>().mockResolvedValue(response(null, 204));
    send.mockResolvedValueOnce(response({ items: [event(stale), { id: 'evento-ajeno' }, { ...event(`ei${'b'.repeat(64)}`), extendedProperties: { private: { ei_owner: 'otro-dueño', ei_version: '1' } } }] }));
    expect(await new HttpGoogleCalendarGateway(send).publish(owner, connection, [], window)).toEqual({ published: 0, removed: 1 });
    expect(send).toHaveBeenCalledTimes(2); expect(send.mock.calls[1][0]).toContain(stale); expect(send.mock.calls[1][1]?.method).toBe('DELETE');
  });
  it('un conflicto de ID se comprueba antes de modificar y los errores impiden retirar eventos', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ items: [event(`ei${'a'.repeat(64)}`)] })).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(response({ id, extendedProperties: { private: { ei_owner: 'otro', ei_version: '1' } } }));
    await expect(new HttpGoogleCalendarGateway(send).publish(owner, connection, [slot], window)).rejects.toThrow('evento ajeno');
    expect(send.mock.calls.some(call => call[1]?.method === 'PUT' || call[1]?.method === 'DELETE')).toBe(false);
  });
  it('consulta free/busy del principal sin leer eventos y falla cerrado si Google devuelve errores', async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(response({ calendars: { primary: { busy: [{ start: '2026-10-06T10:00Z', end: '2026-10-06T11:00Z' }] } } }));
    const google = new HttpGoogleCalendarGateway(send); expect(await google.busy(grant, window)).toHaveLength(1);
    expect(send.mock.calls[0][0]).toBe('https://www.googleapis.com/calendar/v3/freeBusy'); expect(JSON.parse(String(send.mock.calls[0][1]?.body)).items).toEqual([{ id: 'primary' }]);
    send.mockResolvedValue(response({ calendars: { primary: { busy: [], errors: [{ reason: 'notFound' }] } } })); await expect(google.busy(grant, window)).rejects.toThrow('disponibilidad');
  });
});
