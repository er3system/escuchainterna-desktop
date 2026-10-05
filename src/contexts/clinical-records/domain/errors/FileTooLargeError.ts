import { DomainError } from '@/shared/domain/DomainError';

export class FileTooLargeError extends DomainError {
  public constructor(filename: string, maxMb: number) {
    super(`El archivo "${filename}" supera el límite de ${maxMb} MB.`);
  }
}
