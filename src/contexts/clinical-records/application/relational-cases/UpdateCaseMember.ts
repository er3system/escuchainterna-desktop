import { CaseMemberNotFoundError } from '../../domain/errors/RelationalCaseErrors';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';

/**
 * Actualiza datos estructurales del miembro de un caso: su rol/parentesco en el sistema
 * y si es el paciente identificado. Acotado por dueño (el repo lo garantiza) y por caso.
 */
export class UpdateCaseMember {
  public constructor(private readonly members: CaseMemberRepository) {}

  public async execute(input: {
    caseId: string;
    memberId: string;
    role?: string;
    isIdentifiedPatient?: boolean;
  }): Promise<void> {
    const member = await this.members.findById(input.memberId);
    if (!member || member.memberCaseId() !== input.caseId) {
      throw new CaseMemberNotFoundError(input.memberId);
    }
    if (input.role !== undefined) member.setRole(input.role);
    if (input.isIdentifiedPatient !== undefined) member.setIdentifiedPatient(input.isIdentifiedPatient);
    await this.members.save(member);
  }
}
