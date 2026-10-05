import { randomUUID } from 'node:crypto';
import { FamilyMap } from '../../domain/FamilyMap';
import type { FamilyMapRepository } from '../../domain/repositories/FamilyMapRepository';

export class CreateFamilyMap {
  public constructor(private readonly maps: FamilyMapRepository) {}

  /** Crea un mapa familiar vacío para el paciente y devuelve su id. */
  public async execute(patientId: string, title: string): Promise<string> {
    const map = FamilyMap.create({ id: randomUUID(), patientId, title });
    await this.maps.save(map);
    return map.mapId();
  }
}
