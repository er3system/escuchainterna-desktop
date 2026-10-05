import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Cie11Catalog, Cie11Entry } from '../../domain/repositories/Cie11Catalog';

interface Cie11Row {
  code: string;
  title: string;
  parent: string | null;
  level: number;
  chapter: string;
}

/**
 * node:sqlite devuelve filas con prototipo nulo, que React no puede serializar
 * hacia client components. Este mapeo garantiza objetos planos en la frontera.
 */
function toPlainEntry(row: Cie11Row): Cie11Entry {
  return { code: row.code, title: row.title, parent: row.parent, level: row.level, chapter: row.chapter };
}

export class SqliteCie11Catalog implements Cie11Catalog {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async searchByText(text: string, limit: number): Promise<Cie11Entry[]> {
    if (!text) return [];
    const like = `%${text}%`;
    const rows = await this.db.query<Cie11Row>(
      `SELECT * FROM cie11_entries
         WHERE title LIKE ? OR code LIKE ?
         ORDER BY level, code
         LIMIT ?`,
      [like, `${text}%`, limit],
    );
    return rows.map(toPlainEntry);
  }

  public async childrenOf(parentCode: string | null, chapter: string): Promise<Cie11Entry[]> {
    if (parentCode === null) {
      const roots = await this.db.query<Cie11Row>(
        'SELECT * FROM cie11_entries WHERE parent IS NULL AND chapter = ? ORDER BY code',
        [chapter],
      );
      return roots.map(toPlainEntry);
    }
    const rows = await this.db.query<Cie11Row>(
      'SELECT * FROM cie11_entries WHERE parent = ? ORDER BY code',
      [parentCode],
    );
    return rows.map(toPlainEntry);
  }

  public async ancestorsOf(code: string): Promise<Cie11Entry[]> {
    const ancestors: Cie11Entry[] = [];
    let current = await this.findByCode(code);
    let guard = 0;
    while (current && current.parent && guard < 10) {
      const parent = await this.findByCode(current.parent);
      if (!parent) break;
      ancestors.unshift(parent);
      current = parent;
      guard += 1;
    }
    return ancestors;
  }

  public async findByCode(code: string): Promise<Cie11Entry | null> {
    const row = await this.db.queryRow<Cie11Row>('SELECT * FROM cie11_entries WHERE code = ?', [code]);
    return row ? toPlainEntry(row) : null;
  }

  public async totalEntries(): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>('SELECT COUNT(*) AS n FROM cie11_entries');
    return row ? row.n : 0;
  }
}
