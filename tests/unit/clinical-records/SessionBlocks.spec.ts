import { describe, it, expect } from 'vitest';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import { AddSessionBlock } from '@/contexts/clinical-records/application/session-blocks/AddSessionBlock';
import { RemoveSessionBlock } from '@/contexts/clinical-records/application/session-blocks/RemoveSessionBlock';
import { searchHistoriaBlocks } from '@/contexts/clinical-records/domain/historiaBlocks';
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

describe('Bloques por sesión (P6.1)', () => {
  it('addSection/removeSection sobreviven el round-trip de primitives', () => {
    const n = note('n1');
    expect(n.ownSections()).toBeNull();
    n.addSection({ id: 'bloque:x', title: 'X', fields: [{ id: 'bloque:x::a', label: 'A', type: 'texto_corto' }] });
    const clone = SessionNote.fromPrimitives(n.toPrimitives());
    expect(clone.ownSections()).toHaveLength(1);
    expect(clone.ownSections()![0].id).toBe('bloque:x');
    clone.removeSection('bloque:x');
    expect(clone.ownSections()).toBeNull();
  });

  it('addSection no duplica por id', () => {
    const n = note('n2');
    const section = { id: 'bloque:x', title: 'X', fields: [] };
    n.addSection(section);
    n.addSection(section);
    expect(n.ownSections()).toHaveLength(1);
  });

  it('AddSessionBlock añade un bloque del catálogo namespaced', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('n3'));
    await new AddSessionBlock(repo).execute('n3', 'pac-1', 'bloque:analisis-funcional-abc');

    const sections = (await repo.findById('n3'))!.ownSections();
    expect(sections).toHaveLength(1);
    expect(sections![0].id).toBe('bloque:analisis-funcional-abc');
    // Los campos quedan prefijados con el id del bloque (sin colisión de answers).
    expect(sections![0].fields.every((f) => f.id.startsWith('bloque:analisis-funcional-abc::'))).toBe(true);
  });

  it('AddSessionBlock RECHAZA un bloque que no es añadible en sesión (genograma)', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('n4'));
    // genograma.addableIn = ['primera','nucleo'] (no 'sesion') → no-op.
    await new AddSessionBlock(repo).execute('n4', 'pac-1', 'bloque:genograma');
    expect((await repo.findById('n4'))!.ownSections()).toBeNull();
  });

  it('AddSessionBlock exige pertenencia al paciente', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('n5'));
    await expect(new AddSessionBlock(repo).execute('n5', 'otro', 'bloque:analisis-funcional-abc')).rejects.toThrow();
  });

  it('RemoveSessionBlock quita el bloque pero no toca la plantilla fija (ids sin ":")', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('n6'));
    const add = new AddSessionBlock(repo);
    await add.execute('n6', 'pac-1', 'bloque:analisis-funcional-abc');
    const remove = new RemoveSessionBlock(repo);
    // Un id sin ':' (campo de plantilla fija) es no-op.
    await remove.execute('n6', 'pac-1', 'riesgo-nivel');
    expect((await repo.findById('n6'))!.ownSections()).toHaveLength(1);
    // El bloque namespaced sí se quita.
    await remove.execute('n6', 'pac-1', 'bloque:analisis-funcional-abc');
    expect((await repo.findById('n6'))!.ownSections()).toBeNull();
  });

  it('mergeAnswers funde sin pisar respuestas de otras secciones (base + bloque)', () => {
    const n = note('m1');
    n.mergeAnswers({ 'riesgo-nivel': 'Alto' }); // campo del formulario base
    n.mergeAnswers({ 'bloque:analisis-funcional-abc::antecedentes': 'X' }); // campo de un bloque
    const a = n.toPrimitives().answers;
    expect(a['riesgo-nivel']).toBe('Alto');
    expect(a['bloque:analisis-funcional-abc::antecedentes']).toBe('X');
    // Vaciar un campo lo elimina SIN tocar el otro.
    n.mergeAnswers({ 'riesgo-nivel': '' });
    const b = n.toPrimitives().answers;
    expect(b['riesgo-nivel']).toBeUndefined();
    expect(b['bloque:analisis-funcional-abc::antecedentes']).toBe('X');
  });

  it('quitar un bloque PODA sus respuestas: no quedan huérfanas ni reaparecen al re-añadir', async () => {
    const repo = new InMemoryNotes();
    await repo.save(note('m2'));
    const add = new AddSessionBlock(repo);
    const remove = new RemoveSessionBlock(repo);

    await add.execute('m2', 'pac-1', 'bloque:analisis-funcional-abc');
    // El profesional escribe en un campo del bloque.
    const n1 = (await repo.findById('m2'))!;
    n1.mergeAnswers({ 'bloque:analisis-funcional-abc::antecedentes': 'Consumió alcohol el viernes' });
    await repo.save(n1);
    expect((await repo.findById('m2'))!.toPrimitives().answers['bloque:analisis-funcional-abc::antecedentes']).toBe(
      'Consumió alcohol el viernes',
    );

    // Quita el bloque → sus respuestas deben desaparecer (no huérfanas).
    await remove.execute('m2', 'pac-1', 'bloque:analisis-funcional-abc');
    const after = (await repo.findById('m2'))!.toPrimitives();
    expect(after.answers['bloque:analisis-funcional-abc::antecedentes']).toBeUndefined();
    expect(Object.keys(after.answers).some((k) => k.startsWith('bloque:analisis-funcional-abc::'))).toBe(false);

    // Re-añadir el MISMO bloque debe traerlo EN BLANCO (sin el dato viejo).
    await add.execute('m2', 'pac-1', 'bloque:analisis-funcional-abc');
    const reAdded = (await repo.findById('m2'))!.toPrimitives();
    expect(reAdded.answers['bloque:analisis-funcional-abc::antecedentes']).toBeUndefined();
  });

  it('searchHistoriaBlocks(addableIn="sesion") excluye los bloques solo de núcleo/primera', () => {
    const enSesion = searchHistoriaBlocks('', undefined, 'sesion').map((b) => b.id);
    expect(enSesion).toContain('bloque:analisis-funcional-abc');
    expect(enSesion).not.toContain('bloque:genograma'); // ['primera','nucleo']
    expect(enSesion).not.toContain('bloque:objetivos-smart'); // ['primera','nucleo']
    expect(enSesion).not.toContain('bloque:etapa-cambio'); // ['primera','nucleo']
  });
});
