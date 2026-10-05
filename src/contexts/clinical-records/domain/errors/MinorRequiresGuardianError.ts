import { DomainError } from '@/shared/domain/DomainError';

/**
 * Se lanza al intentar emitir el consentimiento de un paciente MENOR de edad que aún no
 * tiene un representante legal (acudiente) registrado. Por la Ley 1581 y el Código Civil
 * colombiano, el consentimiento de un menor lo otorga su representante legal, no el propio
 * menor: emitirlo sin acudiente produciría un documento jurídicamente nulo (antes el
 * sistema degradaba en silencio al flujo de adulto). El profesional debe registrar al
 * acudiente en la ficha del paciente antes de enviar el consentimiento.
 */
export class MinorRequiresGuardianError extends DomainError {
  public constructor() {
    super(
      'Este paciente es menor de edad y todavía no tiene un representante legal (acudiente) ' +
        'registrado. Regístralo en la ficha del paciente antes de enviar el consentimiento: por ley, ' +
        'el consentimiento de un menor lo otorga su representante legal, no el propio menor.',
    );
  }
}
