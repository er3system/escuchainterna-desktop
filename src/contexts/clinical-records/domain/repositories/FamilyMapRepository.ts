import type { FamilyMap } from '../FamilyMap';

export interface FamilyMapRepository {
  save(map: FamilyMap): Promise<void>;
  findById(id: string): Promise<FamilyMap | null>;
  listByPatient(patientId: string): Promise<FamilyMap[]>;
  delete(id: string): Promise<void>;
}
