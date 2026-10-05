import { DomainError } from '@/shared/domain/DomainError';

export class IncompleteGoogleCalendarCredentialsError extends DomainError {
  public constructor() {
    super('Google Calendar requiere tanto el ID de cliente como el secreto de cliente.');
  }
}
