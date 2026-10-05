import { DomainError } from '@/shared/domain/DomainError';

export class PaymentsDisabledByMembershipError extends DomainError {
  public constructor() {
    super('Los pagos están deshabilitados para esta membresía.');
  }
}
