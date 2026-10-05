import { DomainError } from '@/shared/domain/DomainError';

export class InvalidBookingTransitionError extends DomainError {
  public constructor(action: string, status: string) {
    super(`No es posible ${action} una sesión en estado «${status}».`);
  }
}
