import { describe, it, expect } from 'vitest';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import { SetSessionArchived } from '@/contexts/clinical-records/application/set-session-archived/SetSessionArchived';
import { ListSessionNotes } from '@/contexts/clinical-records/application/list-session-notes/ListSessionNotes';
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

function note(id: string): SessionNote {
  return SessionNote.create({ id, patientId: 'pac-1', bookingId: null, title: `Sesión ${id}` });
}

describe('Archivar sesiones (recuperable)', () => {
  it('archive/restore alterna isArchived y sobrevive el round-trip', () => {
    const n = note('n1');
    expect(n.isArchived()).toBe(false);
    n.archive();
    expect(n.isArchived()).toBe(true);
    expect(n.toPrimitives().archived).toBe(true);
    const clone = SessionNote.fromPrimitives(n.toPrimitives());
    expect(clone.isArchived()).toBe(true);
    clone.restore();
    expect(clone.isArchived()).toBe(false);
  });

  it('archive/restore son idempotentes', () => {
    const n = note('n2');
    n.archive();
    n.archive();
    expect(n.isArchived()).toBe(true);
    n.restore();
    n.restore();
    expect(n.isArchived()).toBe(false);
  });

  it('SetSessionArchived requiere que la nota sea del paciente', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('n3'));
    const useCase = new SetSessionArchived(repo);
    await expect(useCase.execute('n3', 'otro-paciente', true)).rejects.toThrow();
    await useCase.execute('n3', 'pac-1', true);
    expect((await repo.findById('n3'))!.isArchived()).toBe(true);
  });

  it('ListSessionNotes separa activas de archivadas', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('activa-1'));
    await repo.save(note('activa-2'));
    const archivada = note('archivada-1');
    archivada.archive();
    await repo.save(archivada);

    const list = new ListSessionNotes(repo);
    expect((await list.execute('pac-1')).map((n) => n.id).sort()).toEqual(['activa-1', 'activa-2']);
    expect((await list.executeArchived('pac-1')).map((n) => n.id)).toEqual(['archivada-1']);
  });
});
