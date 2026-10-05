import { DomainError } from '@/shared/domain/DomainError';

export class InvalidDiagnosisStatusError extends DomainError {
  public constructor(value: string) {
    super(`Estado de diagnóstico inválido: "${value}". Usa activo, descartado o remitido.`);
  }
}
