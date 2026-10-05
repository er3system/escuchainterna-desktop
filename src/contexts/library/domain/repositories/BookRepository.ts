import { Book } from '../Book';

export interface BookSearchCriteria {
  text?: string;
  category?: string;
  onlyFavorites?: boolean;
  limit?: number;
  offset?: number;
}

export interface BookRepository {
  save(book: Book): Promise<void>;
  findById(id: string): Promise<Book | null>;
  findByRelativePath(relativePath: string): Promise<Book | null>;
  search(criteria: BookSearchCriteria): Promise<Book[]>;
  countMatching(criteria: BookSearchCriteria): Promise<number>;
  listCategories(): Promise<Array<{ category: string; total: number }>>;
  totalBooks(): Promise<number>;
  countByFavorite(): Promise<number>;
}
