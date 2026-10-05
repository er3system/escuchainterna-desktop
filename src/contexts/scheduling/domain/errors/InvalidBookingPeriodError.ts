import { DomainError } from '@/shared/domain/DomainError';

export class InvalidBookingPeriodError extends DomainError {
  public constructor() {
    super('El fin de la sesión debe ser posterior a su inicio.');
  }
}
