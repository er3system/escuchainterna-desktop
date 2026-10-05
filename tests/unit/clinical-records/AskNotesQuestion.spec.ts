import { describe, expect, it } from 'vitest';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import type { SessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/SessionNoteRepository';
import type {
  AiInteraction,
  AiInteractionKind,
  AiInteractionLog,
} from '@/contexts/clinical-records/domain/repositories/AiInteractionLog';
import { LocalSessionInsights } from '@/contexts/clinical-records/infrastructure/ai/LocalSessionInsights';
import { AskNotesQuestion } from '@/contexts/clinical-records/application/ask-notes-question/AskNotesQuestion';

class OneNoteRepo implements SessionNoteRepository {
  public constructor(private note: SessionNote | null) {}
  public async save(note: SessionNote): Promise<void> {
    this.note = note;
  }
  public async findById(id: string): Promise<SessionNote | null> {
    return this.note && this.note.noteId() === id ? this.note : null;
  }
  public async listByPatient(): Promise<SessionNote[]> {
    return this.note ? [this.note] : [];
  }
  public async delete(): Promise<void> {
    this.note = null;
  }
}

class MemoryLog implements AiInteractionLog {
  public readonly entries: AiInteraction[] = [];
  public async append(interaction: AiInteraction): Promise<void> {
    this.entries.push(interaction);
  }
  public async listForNote(sessionNoteId: string, kind?: AiInteractionKind): Promise<AiInteraction[]> {
    return this.entries.filter(
      (e) => e.sessionNoteId === sessionNoteId && (kind === undefined || e.kind === kind),
    );
  }
  public async latestForNote(
    sessionNoteId: string,
    kind: AiInteractionKind,
  ): Promise<AiInteraction | null> {
    const matches = await this.listForNote(sessionNoteId, kind);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }
}

describe('AskNotesQuestion', () => {
  it('responde y registra la interacción cuando la nota es del paciente', async () => {
    const note = SessionNote.create({ id: 'n1', patientId: 'p1', bookingId: null, title: 'S' });
    note.edit('S', 'sesion breve. avance notable');
    const log = new MemoryLog();

    const interaction = await new AskNotesQuestion(
      new OneNoteRepo(note),
      new LocalSessionInsights(),
      log,
    ).execute('n1', 'p1', '¿Qué técnica sugieres?');

    expect(interaction.response.length).toBeGreaterThan(0);
    expect(interaction.kind).toBe('pregunta');
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0].sessionNoteId).toBe('n1');
  });

  it('rechaza preguntar sobre una nota de otro paciente (defensa en profundidad)', async () => {
    const note = SessionNote.create({ id: 'n1', patientId: 'p1', bookingId: null, title: 'S' });
    const log = new MemoryLog();

    await expect(
      new AskNotesQuestion(new OneNoteRepo(note), new LocalSessionInsights(), log).execute(
        'n1',
        'OTRO',
        'pregunta',
      ),
    ).rejects.toThrow();
    // No se registra ninguna interacción si la validación falla.
    expect(log.entries).toHaveLength(0);
  });

  it('rechaza una pregunta vacía', async () => {
    const note = SessionNote.create({ id: 'n1', patientId: 'p1', bookingId: null, title: 'S' });
    const log = new MemoryLog();

    await expect(
      new AskNotesQuestion(new OneNoteRepo(note), new LocalSessionInsights(), log).execute(
        'n1',
        'p1',
        '   ',
      ),
    ).rejects.toThrow();
    expect(log.entries).toHaveLength(0);
  });
});
