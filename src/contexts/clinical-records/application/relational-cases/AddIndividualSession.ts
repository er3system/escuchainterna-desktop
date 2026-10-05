import { randomUUID } from 'node:crypto';
import { CaseSessionNote } from '../../domain/CaseSessionNote';
import {
  CaseContraindicatedError,
  CaseMemberNotFoundError,
  RelationalCaseNotFoundError,
  SecretsPolicyRequiredError,
} from '../../domain/errors/RelationalCaseErrors';
import type { CaseMemberRepository } from '../../domain/repositories/CaseMemberRepository';
import type { CaseSessionNoteRepository } from '../../domain/repositories/CaseSessionNoteRepository';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

/**
 * Registra una sesión INDIVIDUAL de un miembro, privada ('individual') o
 * 'confidential'. Exige que el encuadre permita sesiones individuales: política
 * de secretos acordada y caso activo (terapia-pareja: "decidirla antes").
 */
export class AddIndividualSession {
  public constructor(
    private readonly cases: RelationalCaseRepository,
    private readonly members: CaseMemberRepository,
    private readonly sessions: CaseSessionNoteRepository,
  ) {}

  public async execute(input: {
    caseId: string;
    memberId: string;
    title: string;
    content: string;
    confidential: boolean;
  }): Promise<string> {
    const relationalCase = await this.cases.findById(input.caseId);
    if (!relationalCase) throw new RelationalCaseNotFoundError(input.caseId);
    if (!relationalCase.canStartIndividualSession()) {
      throw relationalCase.isActive() ? new SecretsPolicyRequiredError() : new CaseContraindicatedError();
    }
    const member = await this.members.findById(input.memberId);
    if (!member || member.memberCaseId() !== input.caseId) {
      throw new CaseMemberNotFoundError(input.memberId);
    }
    const note = CaseSessionNote.individual({
      id: randomUUID(),
      caseId: input.caseId,
      ownerUserId: relationalCase.toPrimitives().ownerUserId,
      memberId: input.memberId,
      patientId: member.memberPatientId(),
      title: input.title,
      content: input.content,
      confidential: input.confidential,
    });
    await this.sessions.save(note);
    return note.noteId();
  }
}
