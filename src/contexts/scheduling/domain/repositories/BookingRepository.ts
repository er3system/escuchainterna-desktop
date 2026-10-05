import type { Booking } from '../Booking';
import type { Recurrence } from '../Recurrence';

export interface BookingRepository {
  save(booking: Booking): Promise<void>;
  saveRecurrence(recurrence: Recurrence): Promise<void>;
  findById(id: string): Promise<Booking | null>;
  /** Reservas no canceladas que se empalman con [start, end). */
  findOverlapping(start: Date, end: Date, excludeBookingId?: string): Promise<Booking[]>;
  /** Reservas no canceladas con algún traslape con el rango [from, to). */
  findActiveBetween(from: Date, to: Date): Promise<Booking[]>;
}
