import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Book, BookPrimitives } from '../../domain/Book';
import { BookRepository, BookSearchCriteria } from '../../domain/repositories/BookRepository';

interface BookRow {
  id: string;
  title: string;
  author: string;
  category: string;
  subcategory: string;
  relative_path: string;
  extension: string;
  size_bytes: number;
  favorite: number;
  indexed_at: string;
}

export class SqliteBookRepository implements BookRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async save(book: Book): Promise<void> {
    const primitives = book.toPrimitives();
    // Primero intenta actualizar por id (p. ej. al togglear favorito): el upsert por
    // relative_path no actualiza `favorite` (a propósito, para preservarlo entre
    // re-indexaciones) y un INSERT con un id ya existente chocaría con la PK. Como el
    // puerto async no expone `changes`, decidimos UPDATE vs INSERT comprobando antes
    // si la fila existe por id.
    const existing = await this.db.queryRow<{ id: string }>(
      'SELECT id FROM library_books WHERE id = ?',
      [primitives.id],
    );
    if (existing) {
      await this.db.execute(
        `UPDATE library_books SET
           title = ?, author = ?, category = ?, subcategory = ?, relative_path = ?,
           extension = ?, size_bytes = ?, favorite = ?, indexed_at = ?
         WHERE id = ?`,
        [
          primitives.title,
          primitives.author,
          primitives.category,
          primitives.subcategory,
          primitives.relativePath,
          primitives.extension,
          primitives.sizeBytes,
          primitives.favorite ? 1 : 0,
          primitives.indexedAt,
          primitives.id,
        ],
      );
      return;
    }

    await this.db.execute(
      `INSERT INTO library_books (id, title, author, category, subcategory, relative_path, extension, size_bytes, favorite, indexed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(relative_path) DO UPDATE SET
           title = excluded.title,
           author = excluded.author,
           category = excluded.category,
           subcategory = excluded.subcategory,
           extension = excluded.extension,
           size_bytes = excluded.size_bytes`,
      [
        primitives.id,
        primitives.title,
        primitives.author,
        primitives.category,
        primitives.subcategory,
        primitives.relativePath,
        primitives.extension,
        primitives.sizeBytes,
        primitives.favorite ? 1 : 0,
        primitives.indexedAt,
      ],
    );
  }

  public async findById(id: string): Promise<Book | null> {
    const row = await this.db.queryRow<BookRow>('SELECT * FROM library_books WHERE id = ?', [id]);
    return row ? this.hydrate(row) : null;
  }

  public async findByRelativePath(relativePath: string): Promise<Book | null> {
    const row = await this.db.queryRow<BookRow>('SELECT * FROM library_books WHERE relative_path = ?', [
      relativePath,
    ]);
    return row ? this.hydrate(row) : null;
  }

  public async search(criteria: BookSearchCriteria): Promise<Book[]> {
    const { where, params } = this.buildWhere(criteria);
    const limit = criteria.limit ?? 60;
    const offset = criteria.offset ?? 0;
    const rows = await this.db.query<BookRow>(
      `SELECT * FROM library_books ${where} ORDER BY category, title LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async countMatching(criteria: BookSearchCriteria): Promise<number> {
    const { where, params } = this.buildWhere(criteria);
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n FROM library_books ${where}`,
      params,
    );
    return row?.n ?? 0;
  }

  public async listCategories(): Promise<Array<{ category: string; total: number }>> {
    // node:sqlite devuelve filas con prototipo nulo; mapeamos a objetos planos
    // antes de exponerlas en la interfaz pública del contexto.
    const rows = await this.db.query<{ category: string; total: number }>(
      'SELECT category, COUNT(*) AS total FROM library_books GROUP BY category ORDER BY category',
    );
    return rows.map((row) => ({ category: row.category, total: row.total }));
  }

  public async totalBooks(): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>('SELECT COUNT(*) AS n FROM library_books');
    return row?.n ?? 0;
  }

  public async countByFavorite(): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM library_books WHERE favorite = 1',
    );
    return row?.n ?? 0;
  }

  private buildWhere(criteria: BookSearchCriteria): { where: string; params: Array<string | number> } {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (criteria.text) {
      clauses.push('(title LIKE ? OR author LIKE ? OR subcategory LIKE ?)');
      const like = `%${criteria.text}%`;
      params.push(like, like, like);
    }
    if (criteria.category) {
      clauses.push('category = ?');
      params.push(criteria.category);
    }
    if (criteria.onlyFavorites) {
      clauses.push('favorite = 1');
    }
    return { where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  private hydrate(row: BookRow): Book {
    const primitives: BookPrimitives = {
      id: row.id,
      title: row.title,
      author: row.author,
      category: row.category,
      subcategory: row.subcategory,
      relativePath: row.relative_path,
      extension: row.extension,
      sizeBytes: row.size_bytes,
      favorite: row.favorite === 1,
      indexedAt: row.indexed_at,
    };
    return Book.fromPrimitives(primitives);
  }
}
