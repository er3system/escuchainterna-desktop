import { describe, expect, it, vi } from 'vitest';
import { UUID, Email } from '@haskou/value-objects';
import { createHash } from 'node:crypto';
import { DesktopGoogleCalendarClient } from '@/contexts/practitioner/domain/value-objects/DesktopGoogleCalendarClient';
import { GoogleCalendarGrant, GOOGLE_CALENDAR_SCOPES } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarGrant';
import { GoogleCalendarReference } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarReference';
import { LoopbackGoogleAuthorization } from '@/contexts/practitioner/infrastructure/google-calendar/LoopbackGoogleAuthorization';
import { GoogleCalendarConsultation } from '@/contexts/practitioner/application/google-calendar/GoogleCalendarConsultation';
import { CalendarOwnerMessage, CompleteGoogleCalendarMessage, ConnectGoogleCalendarMessage, PublishCalendarMessage } from '@/contexts/practitioner/application/google-calendar/GoogleCalendarMessages';
import { GoogleCalendarConnection } from '@/contexts/practitioner/domain/GoogleCalendarConnection';
import type { GoogleCalendarConnectionRepository } from '@/contexts/practitioner/domain/repositories/GoogleCalendarConnectionRepository';
import type { GoogleCalendarGateway } from '@/contexts/practitioner/domain/GoogleCalendarGateway';
import { CalendarSessionSlot } from '@/contexts/practitioner/domain/CalendarSessionSlot';
import { CalendarTimeWindow } from '@/contexts/practitioner/domain/value-objects/CalendarTimeWindow';
const owner = new UUID('11111111-1111-4111-8111-111111111111');
const origin = 'http://127.0.0.1:49153';
const client = DesktopGoogleCalendarClient.create('12345678-fixture.apps.googleusercontent.com', 'fixture-client-secret');
const grant = (): GoogleCalendarGrant => GoogleCalendarGrant.create('fixture-access', 'fixture-refresh', Date.now() + 3600_000, GOOGLE_CALENDAR_SCOPES.join(' '));
function setup() {
  let saved: GoogleCalendarConnection | null = null;
  const repository: GoogleCalendarConnectionRepository = { find: vi.fn(async () => saved), save: vi.fn(async (_owner, connection) => { saved = connection; }), disconnect: vi.fn(async () => { saved = null; }), ownerIsActive: vi.fn(async () => true) };
  const google: GoogleCalendarGateway = { exchange: vi.fn(async () => grant()), account: vi.fn(async () => new Email('fixture@example.test')), createCalendar: vi.fn(async () => GoogleCalendarReference.create('fixture-calendar@group.calendar.google.com')), refresh: vi.fn(async () => grant()), publish: vi.fn(async () => ({ published: 1, removed: 0 })), busy: vi.fn(async () => []) };
  const flows = new LoopbackGoogleAuthorization(); const schedule = { slots: vi.fn(async (): Promise<readonly CalendarSessionSlot[]> => []) };
  return { repository, google, flows, schedule, useCase: new GoogleCalendarConsultation(repository, google, schedule, flows) };
}
describe('OAuth real de Calendar en PC', () => {
  it('usa PKCE S256, navegador de Google, mínimo alcance y estado ligado a dueño/origen', () => {
    const flows = new LoopbackGoogleAuthorization(); const url = new URL(flows.start(owner, client, origin)); const state = url.searchParams.get('state')!;
    expect(url.origin).toBe('https://accounts.google.com'); expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('calendar.app.created'); expect(url.searchParams.get('scope')).not.toContain('calendar.events ');
    expect(url.toString()).not.toContain('fixture-client-secret');
    const pending = flows.consume(state, origin); expect(pending.owner.toString()).toBe(owner.toString());
    expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(pending.verifier).digest('base64url'));
    expect(() => flows.consume(state, origin)).toThrow('expiró');
  });
  it.each(['https://127.0.0.1:5000', 'http://localhost:5000', 'http://evil.example:5000', 'http://127.0.0.1:5000/x', 'http://user@127.0.0.1:5000'])('rechaza origen %s', unsafe => { expect(() => new LoopbackGoogleAuthorization().start(owner, client, unsafe)).toThrow(); });
  it('caduca a cinco minutos, rechaza otro puerto y reemplaza solicitudes del mismo dueño', () => {
    let now = 1000; const flows = new LoopbackGoogleAuthorization(() => now);
    const old = new URL(flows.start(owner, client, origin)).searchParams.get('state')!;
    const state = new URL(flows.start(owner, client, origin)).searchParams.get('state')!;
    expect(() => flows.ownerFor(old)).toThrow(); expect(() => flows.consume(state, 'http://127.0.0.1:49154')).toThrow();
    const fresh = new URL(flows.start(owner, client, origin)).searchParams.get('state')!; now += 300_000; expect(() => flows.ownerFor(fresh)).toThrow();
  });
  it('no marca conectado por tener client_id y bloquea callbacks cancelados/repetidos', async () => {
    const { useCase, google, repository } = setup();
    const url = new URL(useCase.connect(new ConnectGoogleCalendarMessage(owner.toString(), client.toPrimitives().client_id, '', origin, true)));
    expect((await useCase.summary(new CalendarOwnerMessage(owner.toString()))).connected).toBe(false);
    const message = new CompleteGoogleCalendarMessage(url.searchParams.get('state')!, '', origin, true);
    await expect(useCase.complete(message)).rejects.toThrow('Cancelaste'); expect(google.exchange).not.toHaveBeenCalled(); expect(repository.save).not.toHaveBeenCalled();
    await expect(useCase.complete(message)).rejects.toThrow('expiró');
  });
  it('guarda solo después de autorización, cuenta verificada y calendario real; reutiliza en reautorización', async () => {
    const { useCase, google, repository } = setup();
    for (let index = 0; index < 2; index++) {
      const url = new URL(useCase.connect(new ConnectGoogleCalendarMessage(owner.toString(), client.toPrimitives().client_id, '', origin, true)));
      await useCase.complete(new CompleteGoogleCalendarMessage(url.searchParams.get('state')!, 'fixture-code', origin));
    }
    expect(google.createCalendar).toHaveBeenCalledTimes(1); expect(repository.save).toHaveBeenCalledTimes(2);
    const summary = await useCase.summary(new CalendarOwnerMessage(owner.toString())); expect(summary).toEqual({ connected: true, account: 'fixture@example.test', lastPublishedAt: null, authorizedAt: expect.any(String) });
    expect(JSON.stringify(summary)).not.toMatch(/fixture-access|fixture-refresh|client_secret/);
  });
  it('una cuenta suspendida no recibe tokens ni calendario, ni se sustituye una conexión si Google falla', async () => {
    const { useCase, google, repository } = setup(); vi.mocked(repository.ownerIsActive).mockResolvedValue(false);
    const url = new URL(useCase.connect(new ConnectGoogleCalendarMessage(owner.toString(), client.toPrimitives().client_id, '', origin, true)));
    await expect(useCase.complete(new CompleteGoogleCalendarMessage(url.searchParams.get('state')!, 'code', origin))).rejects.toThrow('cuenta local'); expect(google.exchange).not.toHaveBeenCalled();
    vi.mocked(repository.ownerIsActive).mockResolvedValue(true); vi.mocked(google.createCalendar).mockRejectedValue(new Error('offline'));
    const retry = new URL(useCase.connect(new ConnectGoogleCalendarMessage(owner.toString(), client.toPrimitives().client_id, '', origin, true)));
    await expect(useCase.complete(new CompleteGoogleCalendarMessage(retry.searchParams.get('state')!, 'code', origin))).rejects.toThrow(); expect(repository.save).not.toHaveBeenCalled();
  });
  it('desconectar invalida una autorización pendiente y requiere consentimiento al publicar', async () => {
    const { useCase, flows } = setup(); const state = new URL(flows.start(owner, client, origin)).searchParams.get('state')!;
    await useCase.disconnect(new CalendarOwnerMessage(owner.toString())); expect(() => flows.ownerFor(state)).toThrow();
    expect(() => new PublishCalendarMessage(owner.toString(), '2026-10-01', '2026-10-31', false)).toThrow('Confirma');
    expect(() => CalendarTimeWindow.create('2026-01-01', '2027-01-01')).toThrow('120 días');
    expect(() => GoogleCalendarGrant.create('a', 'r', 1000, 'openid email')).toThrow('Faltan permisos');
  });
  it('consulta intervalos ocupados sin títulos, detecta cruces y excluye extremos adyacentes', async () => {
    const { useCase, repository, google, schedule } = setup();
    await repository.save(owner, new GoogleCalendarConnection(client, grant(), new Email('fixture@example.test'), GoogleCalendarReference.create('fixture')));
    const slot = new CalendarSessionSlot(owner, CalendarTimeWindow.create('2026-10-06T10:00:00Z', '2026-10-06T11:00:00Z'));
    schedule.slots.mockResolvedValue([slot]); vi.mocked(google.busy).mockResolvedValue([CalendarTimeWindow.create('2026-10-06T11:00:00Z', '2026-10-06T12:00:00Z')]);
    const message = new PublishCalendarMessage(owner.toString(), '2026-10-01', '2026-10-31', true);
    expect((await useCase.availability(message)).conflicts).toHaveLength(0);
    vi.mocked(google.busy).mockResolvedValue([CalendarTimeWindow.create('2026-10-06T10:30:00Z', '2026-10-06T12:00:00Z')]); expect((await useCase.availability(message)).conflicts).toHaveLength(1);
  });
});
