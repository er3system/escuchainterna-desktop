import { Email, Timestamp } from '@haskou/value-objects';
import { DesktopGoogleCalendarClient } from './value-objects/DesktopGoogleCalendarClient';
import { GoogleCalendarGrant } from './value-objects/GoogleCalendarGrant';
import { GoogleCalendarReference } from './value-objects/GoogleCalendarReference';
/** Autorización efectiva. Un par client_id/client_secret por sí solo no es una conexión. */
export class GoogleCalendarConnection {
  public constructor(public readonly client: DesktopGoogleCalendarClient, public readonly grant: GoogleCalendarGrant, public readonly account: Email, public readonly calendar: GoogleCalendarReference, public readonly lastPublishedAt: Timestamp | null = null, public readonly authorizedAt: Timestamp = Timestamp.now()) {}
  public belongsTo(account: Email, client: DesktopGoogleCalendarClient): boolean { return this.account.isEqual(account) && this.client.isSameClient(client); }
  public renew(grant: GoogleCalendarGrant): GoogleCalendarConnection { return new GoogleCalendarConnection(this.client, grant, this.account, this.calendar, this.lastPublishedAt, this.authorizedAt); }
  public markPublished(at: Timestamp): GoogleCalendarConnection { return new GoogleCalendarConnection(this.client, this.grant, this.account, this.calendar, at, this.authorizedAt); }
  public toPrimitives(): Record<string, string> { return { ...this.client.toPrimitives(), ...this.grant.toPrimitives(), account_email: this.account.toString(), calendar_id: this.calendar.toString(), desktop_oauth: 'v1', last_published_at: this.lastPublishedAt?.toDate().toISOString() ?? '', authorized_at: this.authorizedAt.toDate().toISOString() }; }
  public static fromPrimitives(config: Record<string, string>): GoogleCalendarConnection {
    if (config.desktop_oauth !== 'v1') throw new Error('No hay autorización OAuth de escritorio.');
    const last = config.last_published_at ? Timestamp.new(config.last_published_at) : null;
    return new GoogleCalendarConnection(DesktopGoogleCalendarClient.create(config.client_id, config.client_secret), GoogleCalendarGrant.create(config.access_token, config.refresh_token, Number(config.expires_at), config.scope), new Email(config.account_email), GoogleCalendarReference.create(config.calendar_id), last, Timestamp.new(config.authorized_at));
  }
}
