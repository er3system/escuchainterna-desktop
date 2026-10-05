import { DomainError } from '@/shared/domain/DomainError';

export class InvalidNotificationContentError extends DomainError {
  public constructor(reason: string) {
    super(reason);
  }
}
