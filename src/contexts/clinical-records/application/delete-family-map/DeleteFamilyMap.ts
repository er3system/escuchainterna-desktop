import type { FamilyMapRepository } from '../../domain/repositories/FamilyMapRepository';
import { FamilyMapNotFoundError } from '../../domain/errors/FamilyMapNotFoundError';

export class DeleteFamilyMap {
  public constructor(private readonly maps: FamilyMapRepository) {}

  public async execute(mapId: string, patientId: string): Promise<void> {
    const map = await this.maps.findById(mapId);
    if (!map || !map.belongsTo(patientId)) {
      throw new FamilyMapNotFoundError(mapId);
    }
    await this.maps.delete(mapId);
  }
}
