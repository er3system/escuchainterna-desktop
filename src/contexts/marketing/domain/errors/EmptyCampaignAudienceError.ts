import { DomainError } from '@/shared/domain/DomainError';

export class EmptyCampaignAudienceError extends DomainError {
  public constructor() {
    super('Selecciona al menos un paciente con correo electrónico registrado.');
  }
}
