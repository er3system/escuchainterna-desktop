import { createHash, randomBytes } from 'node:crypto';
import type { UUID } from '@haskou/value-objects';
import type { DesktopGoogleCalendarClient } from '../../domain/value-objects/DesktopGoogleCalendarClient';
import { GOOGLE_CALENDAR_SCOPES } from '../../domain/value-objects/GoogleCalendarGrant';
import { GoogleCalendarAccessError } from '../../domain/errors/GoogleCalendarAccessError';
import type { PendingCalendarAuthorization, CalendarAuthorizationFlow } from '../../domain/GoogleCalendarAuthorization';
/** Estado de un solo uso, en memoria del proceso, ligado a dueño y origen local exacto. */
export class LoopbackGoogleAuthorization implements CalendarAuthorizationFlow {
  private readonly pending = new Map<string, PendingCalendarAuthorization>();
  public constructor(private readonly now: () => number = Date.now) {}
  public static validateOrigin(origin: string): string {
    let url: URL;
    try { url = new URL(origin); } catch { throw new GoogleCalendarAccessError('Abre esta conexión desde la aplicación instalada.'); }
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new GoogleCalendarAccessError('Abre esta conexión desde la aplicación instalada.');
    return url.origin;
  }
  public start(owner: UUID, client: DesktopGoogleCalendarClient, origin: string): string {
    const redirect = `${LoopbackGoogleAuthorization.validateOrigin(origin)}/api/desktop/google-calendar/callback`;
    for (const [state, pending] of this.pending) if (pending.expires <= this.now()) this.pending.delete(state);
    this.cancel(owner);
    if (this.pending.size >= 32) throw new GoogleCalendarAccessError('Hay demasiadas conexiones pendientes. Espera cinco minutos.');
    const state = randomBytes(32).toString('base64url'); const verifier = randomBytes(32).toString('base64url');
    this.pending.set(state, { owner, client, verifier, redirect, expires: this.now() + 300_000 });
    const query = new URLSearchParams({ client_id: client.toPrimitives().client_id, redirect_uri: redirect, response_type: 'code', scope: GOOGLE_CALENDAR_SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
  }
  public ownerFor(state: string): UUID { const pending = this.pending.get(state); if (!pending || pending.expires <= this.now()) { this.pending.delete(state); throw new GoogleCalendarAccessError('La solicitud expiró o ya se usó. Vuelve a conectar desde EscuchaInterna.'); } return pending.owner; }
  public consume(state: string, origin: string): PendingCalendarAuthorization {
    this.ownerFor(state); const pending = this.pending.get(state)!; this.pending.delete(state);
    if (new URL(pending.redirect).origin !== LoopbackGoogleAuthorization.validateOrigin(origin)) throw new GoogleCalendarAccessError('El retorno de Google no corresponde a esta instalación.');
    return pending;
  }
  public cancel(owner: UUID): void { for (const [state, pending] of this.pending) if (pending.owner.toString() === owner.toString()) this.pending.delete(state); }
}
