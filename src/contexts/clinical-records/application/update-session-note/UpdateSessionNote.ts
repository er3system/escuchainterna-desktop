import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';
import type { UpdateSessionNoteMessage } from './UpdateSessionNoteMessage';

export class UpdateSessionNote {
  public constructor(private readonly notes: SessionNoteRepository) {}

  public async execute(message: UpdateSessionNoteMessage): Promise<void> {
    const note = await this.notes.findById(message.noteId());
    if (!note || !note.belongsTo(message.patientId())) {
      throw new SessionNoteNotFoundError(message.noteId());
    }
    note.edit(message.title(), message.content());
    await this.notes.save(note);
  }
}
