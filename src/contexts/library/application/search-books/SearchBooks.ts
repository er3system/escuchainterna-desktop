import { BookPrimitives } from '../../domain/Book';
import { BookRepository } from '../../domain/repositories/BookRepository';
import { SearchBooksQuery } from './SearchBooksQuery';

export interface BookCatalogPage {
  books: BookPrimitives[];
  total: number;
  categories: Array<{ category: string; total: number }>;
}

export class SearchBooks {
  public constructor(private readonly repository: BookRepository) {}

  public async search(query: SearchBooksQuery): Promise<BookCatalogPage> {
    const criteria = query.toCriteria();
    const [books, total, categories] = await Promise.all([
      this.repository.search(criteria),
      this.repository.countMatching(criteria),
      this.repository.listCategories(),
    ]);
    return {
      books: books.map((book) => book.toPrimitives()),
      total,
      categories,
    };
  }
}
