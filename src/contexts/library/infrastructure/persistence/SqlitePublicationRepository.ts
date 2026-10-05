import type { DatabaseAdapter, SqlParam } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { Publication, PublicationPrimitives, PublicationKind } from '../../domain/Publication';
import {
  PublicationRepository,
  PublicationSearchCriteria,
} from '../../domain/repositories/PublicationRepository';

interface PublicationRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  kind: string;
  country: string;
  html_path: string;
  pdf_path: string;
  sources_json: string;
  favorite: number;
  viewer_favorite: number;
  published_at: string;
  reviewed: number;
  reviewed_at: string | null;
}

export class SqlitePublicationRepository implements PublicationRepository {
  private readonly favoriteUserId: string | null;
  private readonly db: DatabaseAdapter;

  /**
   * Sin userId, el repositorio opera sobre el catálogo compartido y proyecta
   * `favorite=false`. Con userId, las lecturas incorporan exclusivamente la
   * preferencia de ese usuario. La firma que recibía solo un adapter se conserva
   * para tests y consumidores de infraestructura existentes.
   */
  public constructor();
  public constructor(db: DatabaseAdapter);
  public constructor(favoriteUserId: string, db?: DatabaseAdapter);
  public constructor(
    favoriteUserIdOrDb?: string | DatabaseAdapter,
    db?: DatabaseAdapter,
  ) {
    if (typeof favoriteUserIdOrDb === 'string') {
      this.favoriteUserId = favoriteUserIdOrDb;
      this.db = db ?? getDatabaseAdapter();
      return;
    }
    this.favoriteUserId = null;
    this.db = favoriteUserIdOrDb ?? getDatabaseAdapter();
  }

  public async save(publication: Publication): Promise<void> {
    const primitives = publication.toPrimitives();
    await this.db.execute(
      `INSERT INTO library_publications
           (id, title, summary, category, kind, country, html_path, pdf_path, sources_json, favorite, published_at, reviewed, reviewed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           summary = excluded.summary,
           category = excluded.category,
           kind = excluded.kind,
           country = excluded.country,
           html_path = excluded.html_path,
           pdf_path = excluded.pdf_path,
           sources_json = excluded.sources_json,
           published_at = excluded.published_at,
           reviewed = excluded.reviewed,
           reviewed_at = excluded.reviewed_at`,
      [
        primitives.id,
        primitives.title,
        primitives.summary,
        primitives.category,
        primitives.kind,
        primitives.country,
        primitives.htmlPath,
        primitives.pdfPath,
        JSON.stringify(primitives.sources),
        primitives.publishedAt,
        primitives.reviewed ? 1 : 0,
        primitives.reviewedAt,
      ],
    );
  }

  public async addToFavorites(publication: Publication): Promise<void> {
    const userId = this.requireFavoriteUserId();
    await this.db.execute(
      `INSERT INTO library_publication_favorites (user_id, publication_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, publication_id) DO NOTHING`,
      [userId, publication.toPrimitives().id, new Date().toISOString()],
    );
  }

  public async removeFromFavorites(publication: Publication): Promise<void> {
    const userId = this.requireFavoriteUserId();
    await this.db.execute(
      'DELETE FROM library_publication_favorites WHERE user_id = ? AND publication_id = ?',
      [userId, publication.toPrimitives().id],
    );
  }

  public async findById(id: string): Promise<Publication | null> {
    const favorite = this.favoriteProjection();
    const row = await this.db.queryRow<PublicationRow>(
      `SELECT p.*, ${favorite.select}
         FROM library_publications p
         ${favorite.join}
        WHERE p.id = ?`,
      [...favorite.params, id],
    );
    return row ? this.hydrate(row) : null;
  }

  public async search(criteria: PublicationSearchCriteria): Promise<Publication[]> {
    const { where, params } = this.buildWhere(criteria);
    const favorite = this.favoriteProjection();
    const rows = await this.db.query<PublicationRow>(
      `SELECT p.*, ${favorite.select}
         FROM library_publications p
         ${favorite.join}
         ${where}
         ORDER BY CASE p.category
             WHEN 'Modelos terapéuticos' THEN 0
             WHEN 'Temas clínicos' THEN 1
             WHEN 'Marcos normativos' THEN 2
             WHEN 'Pruebas e instrumentos' THEN 3
             ELSE 4
           END, p.country, p.title`,
      [...favorite.params, ...params],
    );
    return rows.map((row) => this.hydrate(row));
  }

  public async countMatching(criteria: PublicationSearchCriteria): Promise<number> {
    const { where, params } = this.buildWhere(criteria);
    const favorite = this.favoriteProjection();
    const row = await this.db.queryRow<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM library_publications p
         ${favorite.join}
         ${where}`,
      [...favorite.params, ...params],
    );
    return row?.n ?? 0;
  }

  public async listCategories(): Promise<Array<{ category: string; total: number }>> {
    // node:sqlite devuelve filas con prototipo nulo; las mapeamos a objetos planos.
    const rows = await this.db.query<{ category: string; total: number }>(
      'SELECT category, COUNT(*) AS total FROM library_publications GROUP BY category',
    );
    return rows.map((row) => ({ category: row.category, total: row.total }));
  }

  public async listCountries(category: string): Promise<Array<{ country: string; total: number }>> {
    const rows = await this.db.query<{ country: string; total: number }>(
      `SELECT country, COUNT(*) AS total FROM library_publications
         WHERE category = ? AND country != ''
         GROUP BY country ORDER BY country`,
      [category],
    );
    return rows.map((row) => ({ country: row.country, total: row.total }));
  }

  public async totalPublications(): Promise<number> {
    const row = await this.db.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM library_publications',
    );
    return row?.n ?? 0;
  }

  public async countFavorites(): Promise<number> {
    if (!this.favoriteUserId) return 0;
    const row = await this.db.queryRow<{ n: number }>(
      'SELECT COUNT(*) AS n FROM library_publication_favorites WHERE user_id = ?',
      [this.favoriteUserId],
    );
    return row?.n ?? 0;
  }

  private buildWhere(criteria: PublicationSearchCriteria): {
    where: string;
    params: SqlParam[];
  } {
    const clauses: string[] = [];
    const params: SqlParam[] = [];
    if (criteria.text) {
      clauses.push('(p.title LIKE ? OR p.summary LIKE ? OR p.country LIKE ?)');
      const like = `%${criteria.text}%`;
      params.push(like, like, like);
    }
    if (criteria.category) {
      clauses.push('p.category = ?');
      params.push(criteria.category);
    }
    if (criteria.country) {
      clauses.push('p.country = ?');
      params.push(criteria.country);
    }
    if (criteria.onlyFavorites) {
      clauses.push(this.favoriteUserId ? 'viewer_favorites.user_id IS NOT NULL' : '1 = 0');
    }
    if (criteria.reviewed !== undefined) {
      clauses.push('p.reviewed = ?');
      params.push(criteria.reviewed ? 1 : 0);
    }
    return { where: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
  }

  private favoriteProjection(): { select: string; join: string; params: SqlParam[] } {
    if (!this.favoriteUserId) {
      return { select: '0 AS viewer_favorite', join: '', params: [] };
    }
    return {
      select: 'CASE WHEN viewer_favorites.user_id IS NULL THEN 0 ELSE 1 END AS viewer_favorite',
      join: `LEFT JOIN library_publication_favorites viewer_favorites
               ON viewer_favorites.publication_id = p.id
              AND viewer_favorites.user_id = ?`,
      params: [this.favoriteUserId],
    };
  }

  private requireFavoriteUserId(): string {
    if (!this.favoriteUserId) {
      throw new Error('El repositorio de publicaciones necesita un usuario para guardar favoritos.');
    }
    return this.favoriteUserId;
  }

  private hydrate(row: PublicationRow): Publication {
    let sources: string[] = [];
    try {
      const parsed = JSON.parse(row.sources_json);
      if (Array.isArray(parsed)) sources = parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      sources = [];
    }
    const primitives: PublicationPrimitives = {
      id: row.id,
      title: row.title,
      summary: row.summary,
      category: row.category,
      kind: row.kind as PublicationKind,
      country: row.country,
      htmlPath: row.html_path,
      pdfPath: row.pdf_path,
      sources,
      favorite: row.viewer_favorite === 1,
      publishedAt: row.published_at,
      reviewed: row.reviewed === 1,
      reviewedAt: row.reviewed_at ?? null,
    };
    return Publication.fromPrimitives(primitives);
  }
}
