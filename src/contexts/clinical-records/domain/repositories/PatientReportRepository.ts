import type { PatientReport } from '../PatientReport';

export interface PatientReportRepository {
  save(report: PatientReport): Promise<void>;
  findById(id: string): Promise<PatientReport | null>;
  listByPatient(patientId: string): Promise<PatientReport[]>;
  delete(id: string): Promise<void>;
}
