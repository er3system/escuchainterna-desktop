import type { UUID } from '@haskou/value-objects';
import { GoogleCalendarConsultation } from '../../application/google-calendar/GoogleCalendarConsultation';
import { SqliteCalendarSchedule } from '../persistence/SqliteCalendarSchedule';
import { SqliteGoogleCalendarConnectionRepository } from '../persistence/SqliteGoogleCalendarConnectionRepository';
import { HttpGoogleCalendarGateway } from './HttpGoogleCalendarGateway';
import { LoopbackGoogleAuthorization } from './LoopbackGoogleAuthorization';
const runtime = globalThis as typeof globalThis & { __calendarAuthorization?: LoopbackGoogleAuthorization; __calendarOperations?: Map<string, Promise<unknown>> };
/** Compartido entre bundles de Next; no persiste códigos ni verificadores OAuth al disco. */
export function calendarAuthorization(): LoopbackGoogleAuthorization { return runtime.__calendarAuthorization ??= new LoopbackGoogleAuthorization(); }
export function createGoogleCalendarConsultation(): GoogleCalendarConsultation { return new GoogleCalendarConsultation(new SqliteGoogleCalendarConnectionRepository(), new HttpGoogleCalendarGateway(), new SqliteCalendarSchedule(), calendarAuthorization()); }
/** Serializa conectar/publicar/renovar/desconectar por dueño para no resucitar tokens tras desconexión. */
export async function withCalendarOwner<T>(owner: UUID, operation: () => Promise<T>): Promise<T> {
  const queues = runtime.__calendarOperations ??= new Map(); const key = owner.toString();
  const previous = queues.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(operation); queues.set(key, current);
  try { return await current; } finally { if (queues.get(key) === current) queues.delete(key); }
}
