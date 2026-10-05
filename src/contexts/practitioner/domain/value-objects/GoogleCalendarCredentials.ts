import { IncompleteGoogleCalendarCredentialsError } from '../errors/IncompleteGoogleCalendarCredentialsError';

export interface GoogleCalendarCredentialsPrimitives {
  client_id?: string;
  client_secret?: string;
}

/** Par indivisible de credenciales OAuth de Google Calendar. */
export class GoogleCalendarCredentials {
  private constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  public static create(
    config: GoogleCalendarCredentialsPrimitives,
  ): GoogleCalendarCredentials | null {
    const clientId = String(config.client_id ?? '').trim();
    const clientSecret = String(config.client_secret ?? '').trim();
    if (!clientId && !clientSecret) return null;
    if (!clientId || !clientSecret) throw new IncompleteGoogleCalendarCredentialsError();
    return new GoogleCalendarCredentials(clientId, clientSecret);
  }

  public static areComplete(config: GoogleCalendarCredentialsPrimitives): boolean {
    return Boolean(String(config.client_id ?? '').trim() && String(config.client_secret ?? '').trim());
  }

  public toPrimitives(): Required<GoogleCalendarCredentialsPrimitives> {
    return { client_id: this.clientId, client_secret: this.clientSecret };
  }
}
