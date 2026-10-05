import { GoogleCalendarAccessError } from '../errors/GoogleCalendarAccessError';
/** Cliente público de aplicación instalada; nunca sustituye el consentimiento de Google. */
export class DesktopGoogleCalendarClient {
  private constructor(private readonly id: string, private readonly secret: string) {}
  public static create(id: string, secret = ''): DesktopGoogleCalendarClient {
    if (!/^[a-zA-Z0-9_-]{8,240}\.apps\.googleusercontent\.com$/.test(id.trim()) || secret.length > 512 || /[\r\n]/.test(secret)) {
      throw new GoogleCalendarAccessError('Introduce el ID de un cliente OAuth de tipo «Aplicación de escritorio», no una clave API.');
    }
    return new DesktopGoogleCalendarClient(id.trim(), secret.trim());
  }
  public isSameClient(other: DesktopGoogleCalendarClient): boolean { return this.id === other.id; }
  public toPrimitives(): { client_id: string; client_secret: string } { return { client_id: this.id, client_secret: this.secret }; }
}
