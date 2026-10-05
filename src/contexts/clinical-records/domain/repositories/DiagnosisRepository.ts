import type { Diagnosis } from '../Diagnosis';

export interface DiagnosisRepository {
  save(diagnosis: Diagnosis): Promise<void>;
  findById(id: string): Promise<Diagnosis | null>;
  listByPatient(patientId: string): Promise<Diagnosis[]>;
  delete(id: string): Promise<void>;
}
