import { DomainError } from '@/shared/domain/DomainError';

export class AdminCannotSuspendSelfError extends DomainError {
  public constructor() {
    super('No puedes suspender tu propia cuenta de administración.');
  }
}
