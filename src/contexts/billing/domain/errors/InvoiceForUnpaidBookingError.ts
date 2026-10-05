import { DomainError } from '@/shared/domain/DomainError';

export class InvoiceForUnpaidBookingError extends DomainError {
  public constructor() {
    super('Solo se puede mandar factura de sesiones pagadas.');
  }
}
