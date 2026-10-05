import { EmptySupervisionReviewChangeError } from './EmptySupervisionReviewChangeError';

/**
 * Upsert de retroalimentación del supervisor sobre una nota: comentario y/o
 * marca de "revisada". Los campos no enviados conservan su valor anterior.
 */
export class SaveSupervisionReviewMessage {
  private readonly trimmedComment: string | undefined;

  public constructor(
    private readonly input: {
      supervisorUserId: string;
      sessionNoteId: string;
      /** undefined = no tocar; '' = borrar el comentario. */
      comment?: string;
      /** undefined = no tocar. */
      reviewed?: boolean;
    },
  ) {
    if (input.comment === undefined && input.reviewed === undefined) {
      throw new EmptySupervisionReviewChangeError();
    }
    this.trimmedComment = input.comment === undefined ? undefined : input.comment.trim();
  }

  public supervisorUserId(): string {
    return this.input.supervisorUserId;
  }

  public sessionNoteId(): string {
    return this.input.sessionNoteId;
  }

  public comment(): string | undefined {
    return this.trimmedComment;
  }

  public reviewed(): boolean | undefined {
    return this.input.reviewed;
  }
}
