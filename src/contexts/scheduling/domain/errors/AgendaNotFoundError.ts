import { DomainError } from '@/shared/domain/DomainError';

export class AgendaNotFoundError extends DomainError {
  public constructor(reference: string) {
    super(`No existe la agenda «${reference}».`);
  }
}
