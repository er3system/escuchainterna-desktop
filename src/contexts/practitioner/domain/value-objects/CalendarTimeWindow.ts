import { GoogleCalendarAccessError } from '../errors/GoogleCalendarAccessError';
export class CalendarTimeWindow {
  private constructor(private readonly start: number, private readonly end: number) {}
  public static create(start: string, end: string, maximumDays = 120): CalendarTimeWindow {
    const from = Date.parse(start); const to = Date.parse(end);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > maximumDays * 86_400_000) throw new GoogleCalendarAccessError('Elige un intervalo válido de hasta 120 días.');
    return new CalendarTimeWindow(from, to);
  }
  public overlaps(other: CalendarTimeWindow): boolean { return this.start < other.end && other.start < this.end; }
  public toPrimitives(): { start: string; end: string } { return { start: new Date(this.start).toISOString(), end: new Date(this.end).toISOString() }; }
}
