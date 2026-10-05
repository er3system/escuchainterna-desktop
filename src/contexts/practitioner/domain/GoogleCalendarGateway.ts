import type { Email, UUID } from '@haskou/value-objects';
import type { DesktopGoogleCalendarClient } from './value-objects/DesktopGoogleCalendarClient';
import type { GoogleCalendarGrant } from './value-objects/GoogleCalendarGrant';
import type { GoogleCalendarReference } from './value-objects/GoogleCalendarReference';
import type { CalendarTimeWindow } from './value-objects/CalendarTimeWindow';
import type { GoogleCalendarConnection } from './GoogleCalendarConnection';
import type { CalendarSessionSlot } from './CalendarSessionSlot';
export interface CalendarPublicationResult { published: number; removed: number }
export interface GoogleCalendarGateway {
  exchange(client: DesktopGoogleCalendarClient, code: string, redirect: string, verifier: string): Promise<GoogleCalendarGrant>;
  account(grant: GoogleCalendarGrant): Promise<Email>;
  createCalendar(grant: GoogleCalendarGrant): Promise<GoogleCalendarReference>;
  refresh(client: DesktopGoogleCalendarClient, grant: GoogleCalendarGrant): Promise<GoogleCalendarGrant>;
  publish(owner: UUID, connection: GoogleCalendarConnection, slots: readonly CalendarSessionSlot[], window: CalendarTimeWindow): Promise<CalendarPublicationResult>;
  busy(grant: GoogleCalendarGrant, window: CalendarTimeWindow): Promise<readonly CalendarTimeWindow[]>;
}
