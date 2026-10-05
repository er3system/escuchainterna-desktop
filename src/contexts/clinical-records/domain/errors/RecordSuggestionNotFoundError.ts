import { DomainError } from '@/shared/domain/DomainError';

export class RecordSuggestionNotFoundError extends DomainError {
  public constructor(suggestionId: string) {
    super(`No se encontró el lote de sugerencias ${suggestionId}.`);
  }
}
