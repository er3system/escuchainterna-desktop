import { DomainError } from '@/shared/domain/DomainError';

export class EmptyPatientTagError extends DomainError {
  public constructor() {
    super('La etiqueta no puede estar vacía.');
  }
}
