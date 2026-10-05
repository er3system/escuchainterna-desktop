import { DomainError } from '@/shared/domain/DomainError';

export class SubscriptionNotFoundError extends DomainError {
  public constructor(userId: string) {
    super(`No existe una suscripción para el usuario ${userId}.`);
  }
}
