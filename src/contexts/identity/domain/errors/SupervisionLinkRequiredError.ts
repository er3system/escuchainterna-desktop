import { DomainError } from '@/shared/domain/DomainError';

/**
 * Toda acción de supervisión activa (retroalimentación, marca de revisión,
 * resumen de caso con IA) exige un vínculo de supervisión vigente
 * supervisor → dueño del dato, con el alcance necesario.
 */
export class SupervisionLinkRequiredError extends DomainError {
  public constructor() {
    super('No tienes un vínculo de supervisión vigente con alcance suficiente sobre este profesional.');
  }
}
