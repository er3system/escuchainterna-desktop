import { InvalidCalendarDateError } from '../errors/InvalidCalendarDateError';

/** Fecha de calendario en formato AAAA-MM-DD (sin hora ni zona horaria). */
export class CalendarDate {
  private readonly value: string;

  public constructor(raw: string) {
    const trimmed = raw.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new InvalidCalendarDateError(trimmed);
    const [year, month, day] = trimmed.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    if (!isRealDate) throw new InvalidCalendarDateError(trimmed);
    this.value = trimmed;
  }

  public static fromNullable(raw: string | null | undefined): CalendarDate | null {
    if (raw === null || raw === undefined || raw.trim().length === 0) return null;
    return new CalendarDate(raw);
  }

  public toString(): string {
    return this.value;
  }
}
