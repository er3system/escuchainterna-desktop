import { BookingPayment } from '../BookingPayment';

export interface BookingPaymentRepository {
  find(bookingId: string): Promise<BookingPayment | null>;
  save(payment: BookingPayment): Promise<void>;
}
