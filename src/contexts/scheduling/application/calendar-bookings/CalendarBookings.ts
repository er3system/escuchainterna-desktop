import type {
  BookingCalendarReadModel,
  CalendarBookingRow,
} from '../../domain/repositories/BookingCalendarReadModel';
import type { CalendarBookingsQuery } from './CalendarBookingsQuery';

/** Indicador visual del último WhatsApp: reloj (pendiente), ✓ (enviado), ✓✓ (recibido/leído). */
export type WhatsappIndicator = 'reloj' | 'check' | 'doble_check';

export interface CalendarBookingItem extends Omit<CalendarBookingRow, 'lastWhatsappStatus'> {
  whatsappStatus: string | null;
  whatsappIndicator: WhatsappIndicator | null;
}

/** Read model para pintar el calendario de la agenda. */
export class CalendarBookings {
  public constructor(private readonly readModel: BookingCalendarReadModel) {}

  public async list(query: CalendarBookingsQuery): Promise<CalendarBookingItem[]> {
    const rows = await this.readModel.findBetween(query.fromDate(), query.toDate());
    return rows.map((row) => {
      const { lastWhatsappStatus, ...rest } = row;
      return {
        ...rest,
        whatsappStatus: lastWhatsappStatus,
        whatsappIndicator: CalendarBookings.indicatorFor(lastWhatsappStatus),
      };
    });
  }

  private static indicatorFor(status: string | null): WhatsappIndicator | null {
    if (status === 'pendiente') return 'reloj';
    if (status === 'enviado') return 'check';
    if (status === 'recibido' || status === 'leido') return 'doble_check';
    return null;
  }
}
