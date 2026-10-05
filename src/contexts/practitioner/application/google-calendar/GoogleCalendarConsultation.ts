import type { GoogleCalendarConnectionRepository } from '../../domain/repositories/GoogleCalendarConnectionRepository';
import type { GoogleCalendarGateway, CalendarPublicationResult } from '../../domain/GoogleCalendarGateway';
import type { CalendarSchedule } from '../../domain/CalendarSchedule';
import { GoogleCalendarConnection } from '../../domain/GoogleCalendarConnection';
import { GoogleCalendarAccessError } from '../../domain/errors/GoogleCalendarAccessError';
import type { CalendarAuthorizationFlow } from '../../domain/GoogleCalendarAuthorization';
import type { CalendarOwnerMessage, CompleteGoogleCalendarMessage, ConnectGoogleCalendarMessage, PublishCalendarMessage } from './GoogleCalendarMessages';
import { Timestamp } from '@haskou/value-objects';
export interface CalendarConnectionSummary { connected: boolean; account: string; lastPublishedAt: string | null; authorizedAt: string | null }
export class GoogleCalendarConsultation {
  public constructor(private readonly repository: GoogleCalendarConnectionRepository, private readonly google: GoogleCalendarGateway, private readonly schedule: CalendarSchedule, private readonly authorization: CalendarAuthorizationFlow) {}
  public connect(message: ConnectGoogleCalendarMessage): string { return this.authorization.start(message.owner, message.client, message.origin); }
  public async complete(message: CompleteGoogleCalendarMessage): Promise<void> {
    const pending = this.authorization.consume(message.state, message.origin);
    if (message.denied) throw new GoogleCalendarAccessError('Cancelaste la autorización. Tu cuenta sigue sin cambios.');
    if (!await this.repository.ownerIsActive(pending.owner)) throw new GoogleCalendarAccessError('La cuenta local ya no puede configurar esta conexión.');
    const grant = await this.google.exchange(pending.client, message.code, pending.redirect, pending.verifier);
    const account = await this.google.account(grant);
    const previous = await this.repository.find(pending.owner);
    const calendar = previous?.belongsTo(account, pending.client) ? previous.calendar : await this.google.createCalendar(grant);
    await this.repository.save(pending.owner, new GoogleCalendarConnection(pending.client, grant, account, calendar));
  }
  public async summary(message: CalendarOwnerMessage): Promise<CalendarConnectionSummary> {
    const connection = await this.repository.find(message.owner);
    return { connected: Boolean(connection), account: connection?.account.toString() ?? '', lastPublishedAt: connection?.lastPublishedAt?.toDate().toISOString() ?? null, authorizedAt: connection?.authorizedAt.toDate().toISOString() ?? null };
  }
  private async ready(message: CalendarOwnerMessage): Promise<GoogleCalendarConnection> {
    let connection = await this.repository.find(message.owner);
    if (!connection) throw new GoogleCalendarAccessError('Conecta primero tu cuenta de Google.');
    if (connection.grant.needsRefresh(Date.now())) { connection = connection.renew(await this.google.refresh(connection.client, connection.grant)); await this.repository.save(message.owner, connection); }
    return connection;
  }
  public async publish(message: PublishCalendarMessage): Promise<CalendarPublicationResult> {
    const slots = await this.schedule.slots(message.owner, message.window);
    const connection = await this.ready(message);
    const result = await this.google.publish(message.owner, connection, slots, message.window);
    await this.repository.save(message.owner, connection.markPublished(Timestamp.now()));
    return result;
  }
  public async availability(message: PublishCalendarMessage): Promise<{ sessions: number; conflicts: Array<{ start: string; end: string }> }> {
    const slots = await this.schedule.slots(message.owner, message.window);
    const connection = await this.ready(message); const busy = await this.google.busy(connection.grant, message.window);
    return { sessions: slots.length, conflicts: slots.filter(slot => busy.some(interval => interval.overlaps(slot.time))).map(slot => slot.time.toPrimitives()) };
  }
  public async disconnect(message: CalendarOwnerMessage): Promise<void> { this.authorization.cancel(message.owner); await this.repository.disconnect(message.owner); }
}
