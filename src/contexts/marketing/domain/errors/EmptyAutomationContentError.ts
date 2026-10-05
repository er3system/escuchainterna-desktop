import { DomainError } from '@/shared/domain/DomainError';

export class EmptyAutomationContentError extends DomainError {
  public constructor() {
    super('Una automatización activa necesita asunto y mensaje.');
  }
}
