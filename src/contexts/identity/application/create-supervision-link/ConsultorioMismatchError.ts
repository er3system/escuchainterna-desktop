import { DomainError } from '@/shared/domain/DomainError';

/**
 * Aislamiento de consultorio (consultorios-spec §3, F4): no se puede vincular a un
 * supervisor y un supervisado de DISTINTOS consultorios. Un vínculo así no concedería
 * nada (el enforcement lo bloquea en cada lectura), así que se rechaza al crear para
 * no dejar vínculos muertos. Mover a alguno de consultorio primero, o dejarlo sin
 * consultorio.
 */
export class ConsultorioMismatchError extends DomainError {
  public constructor() {
    super(
      'El supervisor y el supervisado están en consultorios distintos. Asígnalos al mismo consultorio (o quita el consultorio de alguno) antes de vincularlos.',
    );
  }
}
