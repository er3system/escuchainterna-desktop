import type { FamilyMapRepository } from '../../domain/repositories/FamilyMapRepository';
import { FamilyMapNotFoundError } from '../../domain/errors/FamilyMapNotFoundError';
import type { SaveFamilyMapMessage } from './SaveFamilyMapMessage';

/**
 * Guarda título, miembros y vínculos (posiciones incluidas) de un genograma.
 * El dato crudo de la UI se normaliza en el agregado (descarta basura).
 */
export class SaveFamilyMap {
  public constructor(private readonly maps: FamilyMapRepository) {}

  public async execute(message: SaveFamilyMapMessage): Promise<void> {
    const map = await this.maps.findById(message.mapId());
    if (!map || !map.belongsTo(message.patientId())) {
      throw new FamilyMapNotFoundError(message.mapId());
    }
    map.rename(message.title());
    map.replaceData(message.data());
    await this.maps.save(map);
  }
}
