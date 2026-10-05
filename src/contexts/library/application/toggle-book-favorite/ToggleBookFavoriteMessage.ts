import { UUID } from '@haskou/value-objects';

export class ToggleBookFavoriteMessage {
  private readonly bookId: UUID;

  public constructor(input: { bookId: string }) {
    this.bookId = new UUID(input.bookId.trim());
  }

  public bookIdValue(): string {
    return this.bookId.toString();
  }
}
