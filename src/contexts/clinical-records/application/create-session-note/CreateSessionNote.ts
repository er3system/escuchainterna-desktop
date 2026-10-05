import { randomUUID } from 'node:crypto';
import { SessionNote } from '../../domain/SessionNote';
import { sessionTemplateForKind } from '../../domain/sessionTemplates';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { CreateSessionNoteMessage } from './CreateSessionNoteMessage';

export class CreateSessionNote {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(message: CreateSessionNoteMessage): Promise<string> {
    const kind = message.sessionKind();
    // Se anexa al final de la Evolución (position = MAX+1): la más reciente.
    const existing = await this.notes.listByPatient(message.patientId());
    const maxPosition = existing.reduce((max, note) => Math.max(max, note.position()), -1);
    const note = SessionNote.create({
      id: randomUUID(),
      patientId: message.patientId(),
      bookingId: message.bookingId(),
      title: message.title(),
      templateId: sessionTemplateForKind(kind).id,
      sessionKind: kind,
      position: maxPosition + 1,
    });
    await this.notes.save(note);
    return note.noteId();
  }
}
