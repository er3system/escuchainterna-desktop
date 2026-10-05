import type { UUID } from '@haskou/value-objects';
import type { DesktopGoogleCalendarClient } from './value-objects/DesktopGoogleCalendarClient';
export interface PendingCalendarAuthorization { owner: UUID; client: DesktopGoogleCalendarClient; verifier: string; redirect: string; expires: number }
export interface CalendarAuthorizationFlow {
  start(owner: UUID, client: DesktopGoogleCalendarClient, origin: string): string;
  ownerFor(state: string): UUID;
  consume(state: string, origin: string): PendingCalendarAuthorization;
  cancel(owner: UUID): void;
}
