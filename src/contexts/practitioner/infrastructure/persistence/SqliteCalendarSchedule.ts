import { UUID } from '@haskou/value-objects';
import type { CalendarSchedule } from '../../domain/CalendarSchedule';
import { CalendarSessionSlot } from '../../domain/CalendarSessionSlot';
import { CalendarTimeWindow } from '../../domain/value-objects/CalendarTimeWindow';
import { GoogleCalendarAccessError } from '../../domain/errors/GoogleCalendarAccessError';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
export class SqliteCalendarSchedule implements CalendarSchedule {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}
  public async slots(owner: UUID, window: CalendarTimeWindow): Promise<readonly CalendarSessionSlot[]> {
    const period = window.toPrimitives();
    const rows = await this.db.query<{ id: string; start_at: string; end_at: string }>("SELECT id, start_at, end_at FROM bookings WHERE owner_user_id = ? AND status != 'cancelada' AND start_at < ? AND end_at > ? ORDER BY start_at LIMIT 501", [owner.toString(), period.end, period.start]);
    if (rows.length > 500) throw new GoogleCalendarAccessError('Hay más de 500 sesiones. Selecciona un intervalo más corto.');
    return rows.map(row => new CalendarSessionSlot(new UUID(row.id), CalendarTimeWindow.create(row.start_at, row.end_at)));
  }
}
