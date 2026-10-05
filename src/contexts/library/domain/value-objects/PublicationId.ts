import { DomainError } from '@/shared/domain/DomainError';

export class InvalidPublicationIdError extends DomainError {
  public constructor(value: string) {
    super(`El identificador de publicación "${value}" no es válido.`);
  }
}

/**
 * Identificador de publicación de la colección: slug en minúsculas
 * (p. ej. "tcc", "normativa-mexico"). No es un UUID: lo definen los
 * autores del manifest para que las rutas sean legibles.
 */
export class PublicationId {
  private static readonly PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

  private readonly value: string;

  public constructor(value: string) {
    const normalized = value.trim();
    if (!PublicationId.PATTERN.test(normalized)) throw new InvalidPublicationIdError(value);
    this.value = normalized;
  }

  public toString(): string {
    return this.value;
  }
}
