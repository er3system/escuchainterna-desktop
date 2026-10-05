import { DomainError } from '@/shared/domain/DomainError';

export class UnknownTemplateKeyError extends DomainError {
  public constructor(key: string) {
    super(`No existe una plantilla integrada con la clave "${key}".`);
  }
}
