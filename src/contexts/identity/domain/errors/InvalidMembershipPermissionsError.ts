import { DomainError } from '@/shared/domain/DomainError';

export class InvalidMembershipPermissionsError extends DomainError {
  public constructor(detail: string) {
    super(`Permisos de membresía inválidos: ${detail}`);
  }
}
