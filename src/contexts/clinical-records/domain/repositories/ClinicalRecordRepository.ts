import type { ClinicalRecord } from '../ClinicalRecord';

export interface ClinicalRecordRepository {
  save(record: ClinicalRecord): Promise<void>;
  findById(id: string): Promise<ClinicalRecord | null>;
  listByPatient(patientId: string): Promise<ClinicalRecord[]>;
  /** La historia clínica primaria (kind='historia') del paciente, si existe. */
  findPrimaryHistory(patientId: string): Promise<ClinicalRecord | null>;
  delete(id: string): Promise<void>;
}
