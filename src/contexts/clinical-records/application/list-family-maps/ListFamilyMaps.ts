import type { FamilyMapPrimitives } from '../../domain/value-objects/familyMapElements';
import type { FamilyMapRepository } from '../../domain/repositories/FamilyMapRepository';

export interface FamilyMapSummary {
  id: string;
  title: string;
  memberCount: number;
  linkCount: number;
  updatedAt: string;
}

export class ListFamilyMaps {
  public constructor(private readonly maps: FamilyMapRepository) {}

  public async execute(patientId: string): Promise<FamilyMapSummary[]> {
    const maps = await this.maps.listByPatient(patientId);
    return maps.map((map) => {
      const primitives: FamilyMapPrimitives = map.toPrimitives();
      return {
        id: primitives.id,
        title: primitives.title,
        memberCount: primitives.data.members.length,
        linkCount: primitives.data.links.length,
        updatedAt: primitives.updatedAt,
      };
    });
  }
}
