import { DomainError } from '@/shared/domain/DomainError';

/** Nadie puede supervisarse a sí mismo. */
export class SelfSupervisionError extends DomainError {
  public constructor() {
    super('El supervisor y la persona supervisada deben ser distintos.');
  }
}
