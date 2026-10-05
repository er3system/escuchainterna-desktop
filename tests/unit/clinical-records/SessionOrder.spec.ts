import { describe, it, expect } from 'vitest';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import { CreateSessionNote } from '@/contexts/clinical-records/application/create-session-note/CreateSessionNote';
import { CreateSessionNoteMessage } from '@/contexts/clinical-records/application/create-session-note/CreateSessionNoteMessage';
import { ReorderSessions } from '@/contexts/clinical-records/application/reorder-sessions/ReorderSessions';
import type { SessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/SessionNoteRepository';

class InMemoryNotes implements SessionNoteRepository {
  public readonly notes: SessionNote[] = [];
  public async save(note: SessionNote): Promise<void> {
    const i = this.notes.findIndex((n) => n.noteId() === note.noteId());
    if (i >= 0) this.notes[i] = note;
    else this.notes.push(note);
  }
  public async findById(id: string): Promise<SessionNote | null> {
    return this.notes.find((n) => n.noteId() === id) ?? null;
  }
  public async listByPatient(patientId: string): Promise<SessionNote[]> {
    return this.notes.filter((n) => n.belongsTo(patientId));
  }
  public async delete(id: string): Promise<void> {
    const i = this.notes.findIndex((n) => n.noteId() === id);
    if (i >= 0) this.notes.splice(i, 1);
  }
}

async function create(repo: InMemoryNotes): Promise<string> {
  return new CreateSessionNote(repo).execute(
    new CreateSessionNoteMessage({ patientId: 'pac-1', title: '', sessionKind: 'seguimiento' }),
  );
}

describe('Orden manual de las sesiones (P8)', () => {
  it('placeAt/position sobreviven el round-trip de primitives', () => {
    const n = SessionNote.create({ id: 'n1', patientId: 'pac-1', bookingId: null, title: 'S' });
    expect(n.position()).toBe(0);
    n.placeAt(3);
    expect(SessionNote.fromPrimitives(n.toPrimitives()).position()).toBe(3);
  });

  it('CreateSessionNote anexa al final: position = MAX+1', async () => {
    const repo = new InMemoryNotes();
    const a = await create(repo);
    const b = await create(repo);
    const c = await create(repo);
    expect((await repo.findById(a))!.position()).toBe(0);
    expect((await repo.findById(b))!.position()).toBe(1);
    expect((await repo.findById(c))!.position()).toBe(2);
  });

  it('ReorderSessions asigna position = índice (arriba→abajo) del paciente', async () => {
    const repo = new InMemoryNotes();
    const a = await create(repo);
    const b = await create(repo);
    const c = await create(repo);

    // Nuevo orden visual: c, a, b
    await new ReorderSessions(repo).execute('pac-1', [c, a, b]);
    expect((await repo.findById(c))!.position()).toBe(0);
    expect((await repo.findById(a))!.position()).toBe(1);
    expect((await repo.findById(b))!.position()).toBe(2);
  });

  it('ReorderSessions rechaza ids de otro paciente', async () => {
    const repo = new InMemoryNotes();
    const a = await create(repo);
    await expect(new ReorderSessions(repo).execute('OTRO', [a])).rejects.toThrow();
  });
});
