import { DomainError } from '@/shared/domain/DomainError';

export class PaymentReminderForPaidBookingError extends DomainError {
  public constructor() {
    super('La sesión ya está pagada: no procede enviar un recordatorio de pago.');
  }
}
