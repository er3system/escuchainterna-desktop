import { describe, expect, it } from 'vitest';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import type { SessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/SessionNoteRepository';
import { LocalSessionInsights } from '@/contexts/clinical-records/infrastructure/ai/LocalSessionInsights';
import { PolishNote } from '@/contexts/clinical-records/application/polish-note/PolishNote';

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

describe('LocalSessionInsights.polishNote', () => {
  it('asea el formato (mayúsculas, puntuación, espacios) sin inventar contenido', async () => {
    const out = await new LocalSessionInsights().polishNote(
      'paciente   llega ansioso. trabajamos respiración',
    );
    expect(out[0]).toBe(out[0].toUpperCase()); // mayúscula inicial
    expect(out.endsWith('.')).toBe(true); // puntuación final
    expect(out).not.toMatch(/ {2,}/); // sin dobles espacios
    expect(out.toLowerCase()).toContain('respiración'); // no pierde lo escrito
  });

  it('texto vacío se devuelve igual', async () => {
    expect(await new LocalSessionInsights().polishNote('')).toBe('');
  });
});

describe('PolishNote', () => {
  it('devuelve un borrador del contenido SIN modificar la nota original', async () => {
    const note = SessionNote.create({ id: 'n1', patientId: 'p1', bookingId: null, title: 'S' });
    note.edit('S', 'sesion breve. avance notable');
    const repo = new OneNoteRepo(note);

    const draft = await new PolishNote(repo, new LocalSessionInsights()).execute('n1', 'p1');

    expect(draft.length).toBeGreaterThan(0);
    expect(draft.toLowerCase()).toContain('avance notable');
    // La nota original no se toca: pulir solo devuelve un borrador.
    expect((await repo.findById('n1'))!.currentContent()).toBe('sesion breve. avance notable');
  });

  it('rechaza pulir una nota de otro paciente', async () => {
    const note = SessionNote.create({ id: 'n1', patientId: 'p1', bookingId: null, title: 'S' });
    const repo = new OneNoteRepo(note);
    await expect(
      new PolishNote(repo, new LocalSessionInsights()).execute('n1', 'OTRO'),
    ).rejects.toThrow();
  });
});
