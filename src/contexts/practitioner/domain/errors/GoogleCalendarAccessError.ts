import { DomainError } from '@/shared/domain/DomainError';
export class GoogleCalendarAccessError extends DomainError {
  public constructor(message = 'No se pudo completar la conexión con Google Calendar. Revisa internet, la API habilitada y el cliente de escritorio.') { super(message); }
}
