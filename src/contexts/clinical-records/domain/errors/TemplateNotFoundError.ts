import { DomainError } from '@/shared/domain/DomainError';

export class TemplateNotFoundError extends DomainError {
  public constructor(templateId: string) {
    super(`No existe la plantilla "${templateId}".`);
  }
}
