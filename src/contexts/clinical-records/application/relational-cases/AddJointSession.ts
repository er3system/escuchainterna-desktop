import { randomUUID } from 'node:crypto';
import { CaseSessionNote } from '../../domain/CaseSessionNote';
import {
  CaseContraindicatedError,
  RelationalCaseNotFoundError,
} from '../../domain/errors/RelationalCaseErrors';
import type { CaseSessionNoteRepository } from '../../domain/repositories/CaseSessionNoteRepository';
import type { RelationalCaseRepository } from '../../domain/repositories/RelationalCaseRepository';

/** Registra una sesión CONJUNTA (compartida con todo el caso). Solo si el caso está activo. */
export class AddJointSession {
  public constructor(
    private readonly cases: RelationalCaseRepository,
    private readonly sessions: CaseSessionNoteRepository,
  ) {}

  public async execute(input: {
    caseId: string;
    title: string;
    content: string;
    attendees?: string[];
  }): Promise<string> {
    const relationalCase = await this.cases.findById(input.caseId);
    if (!relationalCase) throw new RelationalCaseNotFoundError(input.caseId);
    if (!relationalCase.isActive()) throw new CaseContraindicatedError();
    const note = CaseSessionNote.joint({
      id: randomUUID(),
      caseId: input.caseId,
      ownerUserId: relationalCase.toPrimitives().ownerUserId,
      title: input.title,
      content: input.content,
      attendees: input.attendees,
    });
    await this.sessions.save(note);
    return note.noteId();
  }
}
