import { DomainError } from '@/shared/domain/DomainError';
export class InvalidPersonalProviderCredentialsError extends DomainError {
  public constructor(message: string) { super(message); }
}
