import { randomUUID } from 'node:crypto';
import type { SessionInsights } from '../../domain/SessionInsights';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { AiInteractionLog, AiInteraction } from '../../domain/repositories/AiInteractionLog';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';

export class AskNotesQuestion {
  public constructor(
    private readonly notes: SessionNoteRepository,
    private readonly insights: SessionInsights,
    private readonly log: AiInteractionLog,
  ) {}

  /** Pregunta a la IA sobre las notas guardadas y persiste la interacción. */
  public async execute(noteId: string, patientId: string, question: string): Promise<AiInteraction> {
    const note = await this.notes.findById(noteId);
    if (!note || !note.belongsTo(patientId)) throw new SessionNoteNotFoundError(noteId);
    const trimmed = question.trim();
    if (trimmed === '') throw new Error('Escribe una pregunta para la IA.');

    const response = await this.insights.answerQuestion(note.currentContent(), trimmed);
    const interaction: AiInteraction = {
      id: randomUUID(),
      sessionNoteId: noteId,
      kind: 'pregunta',
      prompt: trimmed,
      response,
      provider: this.insights.providerName(),
      createdAt: new Date().toISOString(),
    };
    await this.log.append(interaction);
    return interaction;
  }
}
