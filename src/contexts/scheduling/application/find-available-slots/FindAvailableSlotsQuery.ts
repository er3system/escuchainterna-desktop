import { parseISO, startOfDay } from 'date-fns';
import { InvalidBookingDataError } from '../../domain/errors/InvalidBookingDataError';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_DAYS = 7;
const MAX_DAYS = 60;

export class FindAvailableSlotsQuery {
  private readonly agendaId: string;
  private readonly from: Date;
  private readonly days: number;

  public constructor(input: { agendaId: string; fromDate: string; days?: number }) {
    this.agendaId = (input.agendaId ?? '').trim();
    if (!this.agendaId) {
      throw new InvalidBookingDataError('se requiere la agenda');
    }
    if (!DATE_PATTERN.test(input.fromDate ?? '')) {
      throw new InvalidBookingDataError("la fecha inicial debe tener formato 'yyyy-MM-dd'");
    }
    const parsed = parseISO(input.fromDate);
    if (Number.isNaN(parsed.getTime())) {
      throw new InvalidBookingDataError(`fecha inicial inválida «${input.fromDate}»`);
    }
    this.from = startOfDay(parsed);
    this.days = Math.min(MAX_DAYS, Math.max(1, Math.trunc(input.days ?? DEFAULT_DAYS)));
  }

  public agendaIdValue(): string {
    return this.agendaId;
  }

  public fromDate(): Date {
    return this.from;
  }

  public daysToExplore(): number {
    return this.days;
  }
}
