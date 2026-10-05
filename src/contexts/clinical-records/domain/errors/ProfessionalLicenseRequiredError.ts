import { DomainError } from '@/shared/domain/DomainError';

/**
 * Firmar un documento clínico-legal (o confirmar un diagnóstico formal) exige una
 * tarjeta/registro profesional en el perfil del usuario autenticado. Un practicante
 * sin licencia no puede emitir un documento firmado por su cuenta: debe solicitar la
 * firma de su supervisor.
 */
export class ProfessionalLicenseRequiredError extends DomainError {
  public constructor() {
    super(
      'Para firmar necesitas registrar tu tarjeta profesional en tu perfil. ' +
        'Si eres practicante en supervisión, solicita la firma de tu supervisor.',
    );
  }
}
