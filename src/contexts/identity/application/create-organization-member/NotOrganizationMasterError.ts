import { DomainError } from '@/shared/domain/DomainError';

/** Solo el perfil maestro de la organización puede administrar miembros y branding. */
export class NotOrganizationMasterError extends DomainError {
  public constructor() {
    super('Solo el perfil maestro de la organización puede realizar esta acción.');
  }
}
