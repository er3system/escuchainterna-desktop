import { DomainError } from '@/shared/domain/DomainError';

export class FamilyMapNotFoundError extends DomainError {
  public constructor(mapId: string) {
    super(`No se encontró el mapa familiar ${mapId}.`);
  }
}
