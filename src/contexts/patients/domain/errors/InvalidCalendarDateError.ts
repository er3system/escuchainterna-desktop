import { DomainError } from '@/shared/domain/DomainError';

export class InvalidCalendarDateError extends DomainError {
  public constructor(value: string) {
    super(`formato de fecha inválido: usa AAAA-MM-DD (se recibió «${value}»)`);
  }
}
