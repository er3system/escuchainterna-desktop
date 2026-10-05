import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { BookingPayment } from '../../domain/BookingPayment';
import { BookingPaymentRepository } from '../../domain/repositories/BookingPaymentRepository';

interface PaymentRow {
  id: string;
  payment_status: string;
  payment_method: string | null;
  paid_at: string | null;
}

/** Estado de pago de reservas acotado al dueño (owner_user_id) de la sesión. */
export class SqliteBookingPaymentRepository implements BookingPaymentRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async find(bookingId: string): Promise<BookingPayment | null> {
    const row = await this.db.queryRow<PaymentRow>(
      'SELECT id, payment_status, payment_method, paid_at FROM bookings WHERE id = ? AND owner_user_id = ?',
      [bookingId, this.ownerUserId],
    );
    if (!row) return null;
    return BookingPayment.fromPrimitives({
      bookingId: row.id,
      paymentStatus: row.payment_status === 'pagada' ? 'pagada' : 'pendiente',
      paymentMethod: row.payment_method,
      paidAt: row.paid_at,
    });
  }

  public async save(payment: BookingPayment): Promise<void> {
    const primitives = payment.toPrimitives();
    await this.db.execute(
      'UPDATE bookings SET payment_status = ?, payment_method = ?, paid_at = ? WHERE id = ? AND owner_user_id = ?',
      [
        primitives.paymentStatus,
        primitives.paymentMethod,
        primitives.paidAt,
        primitives.bookingId,
        this.ownerUserId,
      ],
    );
  }
}
