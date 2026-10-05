import { DomainError } from '@/shared/domain/DomainError';

export class CancellationWindowClosedError extends DomainError {
  public constructor(action: string, minHours: number) {
    super(`No es posible ${action} la sesión con menos de ${minHours} horas de anticipación.`);
  }
}
