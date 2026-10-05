import type { PatientFile } from '../PatientFile';

export interface PatientFileRepository {
  save(file: PatientFile): Promise<void>;
  findById(id: string): Promise<PatientFile | null>;
  listByPatient(patientId: string): Promise<PatientFile[]>;
  /** Bytes totales de adjuntos del dueño (para la cuota de almacenamiento). */
  totalSizeForOwner(): Promise<number>;
  delete(id: string): Promise<void>;
}
