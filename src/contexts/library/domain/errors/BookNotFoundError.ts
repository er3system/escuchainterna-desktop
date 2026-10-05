import { DomainError } from '@/shared/domain/DomainError';

export class BookNotFoundError extends DomainError {
  public constructor(bookId: string) {
    super(`No existe un libro con id "${bookId}" en el catálogo.`);
  }
}
