import { randomUUID } from 'node:crypto';
import type { SessionInsights, SessionReport } from '../../domain/SessionInsights';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { AiInteractionLog, AiProvider } from '../../domain/repositories/AiInteractionLog';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';

export interface GeneratedNotesReport {
  report: SessionReport;
  provider: AiProvider;
  generatedAt: string;
}

export class GenerateNotesReport {
  public constructor(
    private readonly notes: SessionNoteRepository,
    private readonly insights: SessionInsights,
    private readonly log: AiInteractionLog,
  ) {}

  /** Genera el reporte de la sesión con IA y lo persiste en ai_interactions (kind 'reporte'). */
  public async execute(noteId: string): Promise<GeneratedNotesReport> {
    const note = await this.notes.findById(noteId);
    if (!note) throw new SessionNoteNotFoundError(noteId);

    const report = await this.insights.generateSessionReport(note.currentContent());
    const generatedAt = new Date().toISOString();
    await this.log.append({
      id: randomUUID(),
      sessionNoteId: noteId,
      kind: 'reporte',
      prompt: 'Generar reporte de la sesión',
      response: JSON.stringify(report),
      provider: this.insights.providerName(),
      createdAt: generatedAt,
    });
    return { report, provider: this.insights.providerName(), generatedAt };
  }
}
