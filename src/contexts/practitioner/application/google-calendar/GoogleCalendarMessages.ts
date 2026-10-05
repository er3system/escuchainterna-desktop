import { UUID } from '@haskou/value-objects';
import { DesktopGoogleCalendarClient } from '../../domain/value-objects/DesktopGoogleCalendarClient';
import { CalendarTimeWindow } from '../../domain/value-objects/CalendarTimeWindow';
import { GoogleCalendarAccessError } from '../../domain/errors/GoogleCalendarAccessError';
export class ConnectGoogleCalendarMessage {
  public readonly owner: UUID; public readonly client: DesktopGoogleCalendarClient;
  public constructor(ownerUserId: string, clientId: string, clientSecret: string, public readonly origin: string, authorized: boolean) {
    if (!authorized) throw new GoogleCalendarAccessError('Confirma los permisos de Google Calendar antes de conectar.');
    this.owner = new UUID(ownerUserId); this.client = DesktopGoogleCalendarClient.create(clientId, clientSecret);
  }
}
export class CompleteGoogleCalendarMessage {
  public constructor(public readonly state: string, public readonly code: string, public readonly origin: string, public readonly denied = false) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(state) || (!denied && (!code || code.length > 4096 || /[\r\n]/.test(code)))) throw new GoogleCalendarAccessError('El retorno de Google no es válido. Vuelve a iniciar la conexión.');
  }
}
export class CalendarOwnerMessage {
  public readonly owner: UUID;
  public constructor(ownerUserId: string) { this.owner = new UUID(ownerUserId); }
}
export class PublishCalendarMessage extends CalendarOwnerMessage {
  public readonly window: CalendarTimeWindow;
  public constructor(ownerUserId: string, start: string, end: string, authorized: boolean) {
    super(ownerUserId);
    if (!authorized) throw new GoogleCalendarAccessError('Confirma la publicación de horarios antes de sincronizar.');
    this.window = CalendarTimeWindow.create(start, end);
  }
}
