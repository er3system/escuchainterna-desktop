import type { RelationalCase } from '../RelationalCase';

export interface RelationalCaseRepository {
  save(relationalCase: RelationalCase): Promise<void>;
  findById(id: string): Promise<RelationalCase | null>;
  /** Casos del dueño (más recientes primero). */
  listByOwner(): Promise<RelationalCase[]>;
  /** Casos en los que el paciente es miembro. */
  listByPatient(patientId: string): Promise<RelationalCase[]>;
  delete(id: string): Promise<void>;
}
