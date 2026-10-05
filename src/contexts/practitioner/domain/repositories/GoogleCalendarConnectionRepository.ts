import type { UUID } from '@haskou/value-objects';
import type { GoogleCalendarConnection } from '../GoogleCalendarConnection';
export interface GoogleCalendarConnectionRepository {
  find(owner: UUID): Promise<GoogleCalendarConnection | null>;
  save(owner: UUID, connection: GoogleCalendarConnection): Promise<void>;
  disconnect(owner: UUID): Promise<void>;
  ownerIsActive(owner: UUID): Promise<boolean>;
}
