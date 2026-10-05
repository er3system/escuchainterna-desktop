import { DomainError } from '@/shared/domain/DomainError';

export class BuiltinTemplateIsReadOnlyError extends DomainError {
  public constructor(templateId: string) {
    super(`La plantilla integrada "${templateId}" es de solo lectura: duplícala para personalizarla.`);
  }
}
