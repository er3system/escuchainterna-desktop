import { DomainError } from '@/shared/domain/DomainError';

/** El perfil maestro no puede desactivarse a sí mismo desde el hub de organización. */
export class CannotDeactivateMasterError extends DomainError {
  public constructor() {
    super('El perfil maestro de la organización no puede desactivarse desde aquí.');
  }
}
