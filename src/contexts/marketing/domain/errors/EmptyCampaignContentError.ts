import { DomainError } from '@/shared/domain/DomainError';

export class EmptyCampaignContentError extends DomainError {
  public constructor() {
    super('El asunto y el mensaje del correo no pueden estar vacíos.');
  }
}
