import { createHash } from 'node:crypto';
import { Email, type UUID } from '@haskou/value-objects';
import type { GoogleCalendarGateway, CalendarPublicationResult } from '../../domain/GoogleCalendarGateway';
import type { DesktopGoogleCalendarClient } from '../../domain/value-objects/DesktopGoogleCalendarClient';
import { GoogleCalendarGrant } from '../../domain/value-objects/GoogleCalendarGrant';
import { GoogleCalendarReference } from '../../domain/value-objects/GoogleCalendarReference';
import { CalendarTimeWindow } from '../../domain/value-objects/CalendarTimeWindow';
import type { GoogleCalendarConnection } from '../../domain/GoogleCalendarConnection';
import type { CalendarSessionSlot } from '../../domain/CalendarSessionSlot';
import { GoogleCalendarAccessError } from '../../domain/errors/GoogleCalendarAccessError';
const API = 'https://www.googleapis.com/calendar/v3';
type GoogleObject = Record<string, unknown>;
function object(value: unknown): GoogleObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GoogleCalendarAccessError('Google devolvió una respuesta inesperada.');
  return value as GoogleObject;
}
class GoogleRequestError extends GoogleCalendarAccessError {
  public constructor(public readonly status: number, message: string) { super(message); }
}
/** Endpoints fijos, sin redirecciones, sin tokens en URLs, logs ni mensajes de error. */
export class HttpGoogleCalendarGateway implements GoogleCalendarGateway {
  public constructor(private readonly send: typeof fetch = fetch) {}
  private async request(url: string, init: RequestInit): Promise<GoogleObject> {
    try {
      const response = await this.send(url, { ...init, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
      if (!response.ok) {
        const hint = response.status === 401 ? 'El acceso de Google caducó o fue revocado. Vuelve a conectar.' : response.status === 403 ? 'Google rechazó el acceso. Revisa Calendar API y los permisos concedidos.' : response.status === 429 ? 'Google limitó las solicitudes. Espera un momento y reintenta.' : 'Google no pudo completar la operación. Revisa la configuración y reintenta.';
        throw new GoogleRequestError(response.status, hint);
      }
      if (response.status === 204) return {};
      const text = await response.text();
      if (text.length > 4 * 1024 * 1024) throw new GoogleCalendarAccessError();
      return object(JSON.parse(text));
    } catch (error) {
      if (error instanceof GoogleCalendarAccessError) throw error;
      throw new GoogleCalendarAccessError('No se pudo contactar con Google. Comprueba internet y vuelve a intentar; los datos locales siguen disponibles.');
    }
  }
  private headers(grant: GoogleCalendarGrant): Record<string, string> { return { Authorization: `Bearer ${grant.toPrimitives().access_token}`, 'Content-Type': 'application/json' }; }
  private token(body: GoogleObject, fallback?: GoogleCalendarGrant): GoogleCalendarGrant {
    const previous = fallback?.toPrimitives();
    const expires = body.expires_in;
    if (body.token_type !== 'Bearer' || typeof body.access_token !== 'string' || typeof expires !== 'number' || expires <= 0 || expires > 86_400) throw new GoogleCalendarAccessError();
    return GoogleCalendarGrant.create(body.access_token, typeof body.refresh_token === 'string' ? body.refresh_token : previous?.refresh_token ?? '', Date.now() + expires * 1000, typeof body.scope === 'string' ? body.scope : previous?.scope ?? '');
  }
  public async exchange(client: DesktopGoogleCalendarClient, code: string, redirect: string, verifier: string): Promise<GoogleCalendarGrant> {
    const config = client.toPrimitives();
    const params = new URLSearchParams({ ...config, code, redirect_uri: redirect, code_verifier: verifier, grant_type: 'authorization_code' });
    return this.token(await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }));
  }
  public async refresh(client: DesktopGoogleCalendarClient, grant: GoogleCalendarGrant): Promise<GoogleCalendarGrant> {
    const params = new URLSearchParams({ ...client.toPrimitives(), refresh_token: grant.toPrimitives().refresh_token, grant_type: 'refresh_token' });
    return this.token(await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() }), grant);
  }
  public async account(grant: GoogleCalendarGrant): Promise<Email> {
    const profile = await this.request('https://openidconnect.googleapis.com/v1/userinfo', { headers: this.headers(grant) });
    if (typeof profile.email !== 'string' || profile.email_verified !== true) throw new GoogleCalendarAccessError('Google no devolvió una cuenta verificada.');
    return new Email(profile.email);
  }
  public async createCalendar(grant: GoogleCalendarGrant): Promise<GoogleCalendarReference> {
    const calendar = await this.request(`${API}/calendars`, { method: 'POST', headers: this.headers(grant), body: JSON.stringify({ summary: 'EscuchaInterna', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) });
    return GoogleCalendarReference.create(typeof calendar.id === 'string' ? calendar.id : '');
  }
  public async busy(grant: GoogleCalendarGrant, window: CalendarTimeWindow): Promise<readonly CalendarTimeWindow[]> {
    const period = window.toPrimitives();
    const result = await this.request(`${API}/freeBusy`, { method: 'POST', headers: this.headers(grant), body: JSON.stringify({ timeMin: period.start, timeMax: period.end, items: [{ id: 'primary' }] }) });
    const calendars = object(result.calendars); const primary = object(calendars.primary);
    if ((Array.isArray(primary.errors) && primary.errors.length) || !Array.isArray(primary.busy) || primary.busy.length > 5000) throw new GoogleCalendarAccessError('No se pudo consultar tu disponibilidad personal.');
    return primary.busy.map(value => { const interval = object(value); if (typeof interval.start !== 'string' || typeof interval.end !== 'string') throw new GoogleCalendarAccessError(); return CalendarTimeWindow.create(interval.start, interval.end); });
  }
  public async publish(owner: UUID, connection: GoogleCalendarConnection, slots: readonly CalendarSessionSlot[], window: CalendarTimeWindow): Promise<CalendarPublicationResult> {
    const deadline = Date.now() + 120_000;
    const checkDeadline = (): void => { if (Date.now() > deadline) throw new GoogleCalendarAccessError('La sincronización tomó demasiado tiempo. Puede haber avances parciales; reintentar no duplica sesiones.'); };
    const ownerMarker = createHash('sha256').update(owner.toString()).digest('hex');
    const eventsUrl = `${API}/calendars/${encodeURIComponent(connection.calendar.toString())}/events`;
    const headers = this.headers(connection.grant); const period = window.toPrimitives();
    const existing = new Set<string>(); let page = ''; let pages = 0;
    do {
      checkDeadline();
      if (++pages > 4) throw new GoogleCalendarAccessError('Hay demasiados horarios remotos. Elige un intervalo menor.');
      const query = new URLSearchParams({ timeMin: period.start, timeMax: period.end, singleEvents: 'true', maxResults: '1000', privateExtendedProperty: `ei_owner=${ownerMarker}`, fields: 'items(id,extendedProperties/private),nextPageToken' });
      if (page) query.set('pageToken', page);
      const result = await this.request(`${eventsUrl}?${query}`, { headers });
      if (!Array.isArray(result.items)) throw new GoogleCalendarAccessError();
      for (const item of result.items) {
        const event = object(item);
        const marker = event.extendedProperties ? object(object(event.extendedProperties).private) : null;
        if (typeof event.id === 'string' && /^ei[0-9a-f]{64}$/.test(event.id) && marker?.ei_owner === ownerMarker && marker.ei_version === '1') existing.add(event.id);
      }
      page = typeof result.nextPageToken === 'string' ? result.nextPageToken : '';
      if (existing.size > 2000 || page.length > 4096) throw new GoogleCalendarAccessError('Hay demasiados horarios remotos. Elige un intervalo menor.');
    } while (page);
    const expected = new Set<string>(); let published = 0; let removed = 0;
    for (const slot of slots) {
      checkDeadline();
      const id = `ei${createHash('sha256').update(`${owner.toString()}:${slot.booking.toString()}`).digest('hex')}`;
      expected.add(id); const time = slot.time.toPrimitives();
      const body = JSON.stringify({ id, summary: 'Sesión de consulta', status: 'confirmed', start: { dateTime: time.start }, end: { dateTime: time.end }, visibility: 'private', transparency: 'opaque', reminders: { useDefault: false }, guestsCanInviteOthers: false, guestsCanSeeOtherGuests: false, extendedProperties: { private: { ei_owner: ownerMarker, ei_version: '1' } } });
      const update = (): Promise<GoogleObject> => this.request(`${eventsUrl}/${id}?sendUpdates=none`, { method: 'PUT', headers, body });
      if (existing.has(id)) await update();
      else {
        try { await this.request(`${eventsUrl}?sendUpdates=none`, { method: 'POST', headers, body }); }
        catch (error) {
          if (!(error instanceof GoogleRequestError) || error.status !== 409) throw error;
          // Una sesión movida puede existir fuera del intervalo. Comprobar propiedad antes de sobrescribir.
          const event = await this.request(`${eventsUrl}/${id}`, { headers });
          const marker = event.extendedProperties ? object(object(event.extendedProperties).private) : null;
          if (marker?.ei_owner !== ownerMarker || marker.ei_version !== '1') throw new GoogleCalendarAccessError('Existe un evento ajeno con el mismo identificador. No se modificó.');
          await update();
        }
      }
      published++;
    }
    // Solo elimina horarios gestionados por esta cuenta dentro del intervalo explícito.
    for (const id of existing) if (!expected.has(id)) {
      checkDeadline();
      try { await this.request(`${eventsUrl}/${id}?sendUpdates=none`, { method: 'DELETE', headers }); } catch (error) { if (!(error instanceof GoogleRequestError) || ![404, 410].includes(error.status)) throw error; }
      removed++;
    }
    return { published, removed };
  }
}
