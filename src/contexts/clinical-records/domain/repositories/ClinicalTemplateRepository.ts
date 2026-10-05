import type { ClinicalTemplate } from '../ClinicalTemplate';

export interface ClinicalTemplateRepository {
  save(template: ClinicalTemplate): Promise<void>;
  findById(id: string): Promise<ClinicalTemplate | null>;
  listAll(): Promise<ClinicalTemplate[]>;
  delete(id: string): Promise<void>;
}
