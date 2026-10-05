import { DomainError } from '@/shared/domain/DomainError';

export class InvalidTrialExtensionError extends DomainError {
  public constructor(days: number) {
    super(`La extensión del trial debe ser de 1 a 365 días (recibido: ${days}).`);
  }
}
