import { DomainError } from '@/shared/domain/DomainError';

/**
 * Un expediente sellado (cerrado para abrir otro: relevo o episodio anterior) se
 * preserva de SOLO LECTURA por continuidad clínica y retención. Cualquier intento
 * de mutarlo —desde la UI o invocando la acción directamente— se rechaza aquí.
 */
export class SealedRecordIsImmutableError extends DomainError {
  public constructor() {
    super('Este expediente está sellado (anterior) y no puede modificarse.');
  }
}
