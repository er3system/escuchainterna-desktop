import { randomUUID } from 'node:crypto';
import { CaseMember } from '../../domain/CaseMember';
import {
  CaseMemberLimitReachedError,
  PatientAlreadyMemberError,
  RelationalCaseNotFoundError,
} from '../../domain/errors/RelationalCaseErrors';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

/**
 * Vincula un paciente al caso como miembro. Un caso de pareja admite exactamente
 * dos miembros; familia (futuro) no se limita aquí. No duplica un mismo paciente.
 */
export class AddCaseMember {
  public constructor(
    private readonly cases: RelationalCaseRepository,
    private readonly members: CaseMemberRepository,
  ) {}

  public async execute(input: {
    caseId: string;
    patientId: string;
    label: string;
    role?: string;
  }): Promise<string> {
    const relationalCase = await this.cases.findById(input.caseId);
    if (!relationalCase) throw new RelationalCaseNotFoundError(input.caseId);
    const primitives = relationalCase.toPrimitives();
    const existing = await this.members.listByCase(input.caseId);
    if (existing.some((member) => member.memberPatientId() === input.patientId)) {
      throw new PatientAlreadyMemberError();
    }
    if (primitives.kind === 'pareja' && existing.length >= 2) {
      throw new CaseMemberLimitReachedError();
    }
    const member = CaseMember.add({
      id: randomUUID(),
      caseId: input.caseId,
      patientId: input.patientId,
      ownerUserId: primitives.ownerUserId,
      label: input.label,
      role: input.role,
    });
    await this.members.save(member);
    return member.memberId();
  }
}
