import { DomainError } from '@/shared/domain/DomainError';

export class EmptyTemplateContentError extends DomainError {
  public constructor() {
    super('El contenido de la plantilla no puede estar vacío.');
  }
}
