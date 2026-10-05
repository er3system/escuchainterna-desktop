import { describe, expect, it } from 'vitest';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import type { SessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/SessionNoteRepository';
import {
  SESSION_TEMPLATES,
  SESSION_KIND_LABELS,
  SESSION_KINDS,
  sessionKindForTemplateId,
  sessionTemplateForKind,
  isSessionKind,
} from '@/contexts/clinical-records/domain/sessionTemplates';
import { CreateSessionNote } from '@/contexts/clinical-records/application/create-session-note/CreateSessionNote';
import { CreateSessionNoteMessage } from '@/contexts/clinical-records/application/create-session-note/CreateSessionNoteMessage';
import { SaveSessionAnswers } from '@/contexts/clinical-records/application/save-session-answers/SaveSessionAnswers';
import { SaveSessionAnswersMessage } from '@/contexts/clinical-records/application/save-session-answers/SaveSessionAnswersMessage';

class InMemorySessionNotes implements SessionNoteRepository {
  public readonly notes: SessionNote[] = [];
  public async save(note: SessionNote): Promise<void> {
    const index = this.notes.findIndex((n) => n.noteId() === note.noteId());
    if (index >= 0) this.notes[index] = note;
    else this.notes.push(note);
  }
  public async findById(id: string): Promise<SessionNote | null> {
    return this.notes.find((n) => n.noteId() === id) ?? null;
  }
  public async listByPatient(patientId: string): Promise<SessionNote[]> {
    return this.notes.filter((n) => n.belongsTo(patientId));
  }
  public async delete(id: string): Promise<void> {
    const index = this.notes.findIndex((n) => n.noteId() === id);
    if (index >= 0) this.notes.splice(index, 1);
  }
}

describe('Plantillas de sesión', () => {
  it('mapea tipo ↔ plantilla y rechaza ids desconocidos', () => {
    expect(sessionTemplateForKind('primera').id).toBe('session-primera');
    expect(sessionTemplateForKind('seguimiento').id).toBe('session-seguimiento');
    expect(sessionTemplateForKind('nota').id).toBe('session-nota');
    expect(sessionTemplateForKind('valoracion').id).toBe('session-valoracion');
    expect(sessionTemplateForKind('crisis').id).toBe('session-crisis');
    expect(sessionKindForTemplateId('session-primera')).toBe('primera');
    expect(sessionKindForTemplateId('session-seguimiento')).toBe('seguimiento');
    expect(sessionKindForTemplateId('session-nota')).toBe('nota');
    expect(sessionKindForTemplateId('session-valoracion')).toBe('valoracion');
    expect(sessionKindForTemplateId('session-crisis')).toBe('crisis');
    expect(sessionKindForTemplateId('builtin-historia-general')).toBeNull();
    expect(sessionKindForTemplateId(null)).toBeNull();
    expect(isSessionKind('primera')).toBe(true);
    expect(isSessionKind('nota')).toBe(true);
    expect(isSessionKind('valoracion')).toBe(true);
    expect(isSessionKind('crisis')).toBe(true);
    expect(isSessionKind('otra')).toBe(false);
  });

  it('"primera" se etiqueta como "Entrevista inicial"; "Nota" y "Prueba aplicada" existen', () => {
    expect(SESSION_KIND_LABELS.primera).toBe('Entrevista inicial');
    expect(SESSION_KIND_LABELS.nota).toBe('Nota');
    expect(SESSION_KIND_LABELS.valoracion).toBe('Prueba aplicada');
    expect(SESSION_KINDS).toEqual(['primera', 'seguimiento', 'nota', 'valoracion', 'crisis']);
    // La "Atención en crisis" lleva la sección de riesgo (riesgo-nivel) para el chip/banner.
    const crisisFieldIds = sessionTemplateForKind('crisis').sections.flatMap((s) => s.fields.map((f) => f.id));
    expect(crisisFieldIds).toContain('riesgo-nivel');
    // "Nota" es libre: sin formulario base.
    expect(sessionTemplateForKind('nota').sections).toHaveLength(0);
  });

  it('las plantillas de sesión tienen id "session-" (y solo "Nota" puede ir vacía)', () => {
    for (const template of Object.values(SESSION_TEMPLATES)) {
      expect(template.id.startsWith('session-')).toBe(true);
      if (template.id !== 'session-nota') expect(template.sections.length).toBeGreaterThan(0);
    }
  });
});

describe('CreateSessionNote estructurada', () => {
  it("'primera' crea la nota con su plantilla y tipo", async () => {
    const repo = new InMemorySessionNotes();
    const id = await new CreateSessionNote(repo).execute(
      new CreateSessionNoteMessage({ patientId: 'p1', title: '', sessionKind: 'primera' }),
    );
    const note = (await repo.findById(id))!.toPrimitives();
    expect(note.templateId).toBe('session-primera');
    expect(note.sessionKind).toBe('primera');
  });

  it('por defecto (sin tipo válido) es seguimiento', async () => {
    const repo = new InMemorySessionNotes();
    const id = await new CreateSessionNote(repo).execute(
      new CreateSessionNoteMessage({ patientId: 'p1', title: 'Algo', sessionKind: 'no-existe' }),
    );
    const note = (await repo.findById(id))!.toPrimitives();
    expect(note.sessionKind).toBe('seguimiento');
    expect(note.templateId).toBe('session-seguimiento');
  });
});

describe('SaveSessionAnswers', () => {
  it('persiste respuestas del formulario y poda los vacíos', async () => {
    const repo = new InMemorySessionNotes();
    const id = await new CreateSessionNote(repo).execute(
      new CreateSessionNoteMessage({ patientId: 'p1', title: '', sessionKind: 'seguimiento' }),
    );

    await new SaveSessionAnswers(repo).execute(
      new SaveSessionAnswersMessage({
        noteId: id,
        patientId: 'p1',
        answers: { trabajado: 'Reestructuración del pensamiento X', 'plan-proxima': '', tecnicas: ['Exposición'] },
      }),
    );

    const answers = (await repo.findById(id))!.toPrimitives().answers;
    expect(answers['trabajado']).toBe('Reestructuración del pensamiento X');
    expect(answers['tecnicas']).toEqual(['Exposición']);
    expect(answers['plan-proxima']).toBeUndefined(); // vacío podado
  });

  it('rechaza notas de otro paciente', async () => {
    const repo = new InMemorySessionNotes();
    const id = await new CreateSessionNote(repo).execute(
      new CreateSessionNoteMessage({ patientId: 'p1', title: '', sessionKind: 'primera' }),
    );
    await expect(
      new SaveSessionAnswers(repo).execute(
        new SaveSessionAnswersMessage({ noteId: id, patientId: 'OTRO', answers: { motivo: 'x' } }),
      ),
    ).rejects.toThrow();
  });
});
