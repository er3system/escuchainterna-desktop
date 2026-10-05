import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface BookPrimitives {
  id: string;
  title: string;
  author: string;
  category: string;
  subcategory: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
  favorite: boolean;
  indexedAt: string;
}

export class Book extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly title: string,
    private readonly author: string,
    private readonly category: string,
    private readonly subcategory: string,
    private readonly relativePath: string,
    private readonly extension: string,
    private readonly sizeBytes: number,
    private favorite: boolean,
    private readonly indexedAt: Date,
  ) {
    super();
  }

  public static fromPrimitives(primitives: BookPrimitives): Book {
    return new Book(
      primitives.id,
      primitives.title,
      primitives.author,
      primitives.category,
      primitives.subcategory,
      primitives.relativePath,
      primitives.extension,
      primitives.sizeBytes,
      primitives.favorite,
      new Date(primitives.indexedAt),
    );
  }

  public markAsFavorite(): void {
    this.favorite = true;
  }

  public unmarkAsFavorite(): void {
    this.favorite = false;
  }

  public isReadableInBrowser(): boolean {
    return this.extension === '.pdf' || this.extension === '.txt' || this.extension === '.jpg';
  }

  public toPrimitives(): BookPrimitives {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      category: this.category,
      subcategory: this.subcategory,
      relativePath: this.relativePath,
      extension: this.extension,
      sizeBytes: this.sizeBytes,
      favorite: this.favorite,
      indexedAt: this.indexedAt.toISOString(),
    };
  }
}
