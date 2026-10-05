import { DomainError } from '@/shared/domain/DomainError';

export class UnknownAutomationKindError extends DomainError {
  public constructor(kind: string) {
    super(`No existe la automatización "${kind}". Las disponibles son cumpleaños y reactivación.`);
  }
}
