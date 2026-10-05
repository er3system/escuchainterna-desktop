import { InvalidBookingDataError } from '../../domain/errors/InvalidBookingDataError';

export class CalendarBookingsQuery {
  private readonly from: Date;
  private readonly to: Date;

  public constructor(input: { fromIso: string; toIso: string }) {
    this.from = new Date(input.fromIso);
    this.to = new Date(input.toIso);
    if (Number.isNaN(this.from.getTime()) || Number.isNaN(this.to.getTime())) {
      throw new InvalidBookingDataError('el rango del calendario es inválido');
    }
    if (this.to.getTime() <= this.from.getTime()) {
      throw new InvalidBookingDataError('el fin del rango debe ser posterior al inicio');
    }
  }

  public fromDate(): Date {
    return this.from;
  }

  public toDate(): Date {
    return this.to;
  }
}
