import { BookRepository } from '../../domain/repositories/BookRepository';
import { BookNotFoundError } from '../../domain/errors/BookNotFoundError';
import { ToggleBookFavoriteMessage } from './ToggleBookFavoriteMessage';

export interface ToggleBookFavoriteResult {
  favorite: boolean;
}

export class ToggleBookFavorite {
  public constructor(private readonly repository: BookRepository) {}

  public async toggle(message: ToggleBookFavoriteMessage): Promise<ToggleBookFavoriteResult> {
    const book = await this.repository.findById(message.bookIdValue());
    if (!book) throw new BookNotFoundError(message.bookIdValue());

    if (book.toPrimitives().favorite) {
      book.unmarkAsFavorite();
    } else {
      book.markAsFavorite();
    }
    await this.repository.save(book);

    return { favorite: book.toPrimitives().favorite };
  }
}
