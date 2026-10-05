import { BookSearchCriteria } from '../../domain/repositories/BookRepository';

export class SearchBooksQuery {
  public constructor(
    private readonly text: string,
    private readonly category: string,
    private readonly onlyFavorites: boolean,
    private readonly page: number,
    private readonly pageSize: number,
  ) {}

  public static fromPrimitives(input: {
    text?: string;
    category?: string;
    onlyFavorites?: boolean;
    page?: number;
    pageSize?: number;
  }): SearchBooksQuery {
    return new SearchBooksQuery(
      (input.text ?? '').trim(),
      (input.category ?? '').trim(),
      input.onlyFavorites ?? false,
      Math.max(1, input.page ?? 1),
      Math.min(120, Math.max(1, input.pageSize ?? 60)),
    );
  }

  public toCriteria(): BookSearchCriteria {
    return {
      text: this.text || undefined,
      category: this.category || undefined,
      onlyFavorites: this.onlyFavorites || undefined,
      limit: this.pageSize,
      offset: (this.page - 1) * this.pageSize,
    };
  }
}
