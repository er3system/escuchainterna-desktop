import type { CaseMember } from '../CaseMember';

export interface CaseMemberRepository {
  save(member: CaseMember): Promise<void>;
  findById(id: string): Promise<CaseMember | null>;
  /** Miembros de un caso (orden de alta). */
  listByCase(caseId: string): Promise<CaseMember[]>;
  findByCaseAndPatient(caseId: string, patientId: string): Promise<CaseMember | null>;
  delete(id: string): Promise<void>;
}
