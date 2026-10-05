import { DomainError } from '@/shared/domain/DomainError';

export class UserNotFoundError extends DomainError {
  public constructor(userId: string) {
    super(`No existe la cuenta de usuario "${userId}".`);
  }
}
