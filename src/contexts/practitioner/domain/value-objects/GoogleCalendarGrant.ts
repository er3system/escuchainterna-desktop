import { GoogleCalendarAccessError } from '../errors/GoogleCalendarAccessError';
export const GOOGLE_CALENDAR_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.app.created', 'https://www.googleapis.com/auth/calendar.freebusy'] as const;
export class GoogleCalendarGrant {
  private constructor(private readonly access: string, private readonly refresh: string, private readonly expiresAt: number, private readonly scopes: string) {}
  public static create(access: string, refresh: string, expiresAt: number, scopes: string): GoogleCalendarGrant {
    const granted = new Set(scopes.split(/\s+/));
    if (!access || !refresh || access.length > 8192 || refresh.length > 8192 || /[\r\n]/.test(access + refresh) || !Number.isFinite(expiresAt) || expiresAt <= 0) throw new GoogleCalendarAccessError('Google no concedió un acceso renovable. Vuelve a conectar tu cuenta.');
    if (!GOOGLE_CALENDAR_SCOPES.filter(scope => scope.startsWith('https://')).every(scope => granted.has(scope))) throw new GoogleCalendarAccessError('Faltan permisos de Calendar. Vuelve a conectar y autoriza crear el calendario de la app y consultar disponibilidad.');
    return new GoogleCalendarGrant(access, refresh, expiresAt, scopes);
  }
  public needsRefresh(now: number): boolean { return now + 60_000 >= this.expiresAt; }
  public toPrimitives(): { access_token: string; refresh_token: string; expires_at: string; scope: string } { return { access_token: this.access, refresh_token: this.refresh, expires_at: String(this.expiresAt), scope: this.scopes }; }
}
