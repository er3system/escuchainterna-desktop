import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Colección EscuchaInterna (biblioteca v2) contra SQLite real (BD temporal):
 * - el manifest se vuelca a library_publications descartando entradas peligrosas
 *   (path traversal, rutas absolutas, ids inválidos);
 * - recargar el catálogo es idempotente y PRESERVA los favoritos de cada usuario;
 * - la búsqueda filtra por categoría, país y favoritos sin mezclar usuarios.
 */

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-publicaciones-'));
const dbPath = path.join(tempDir, 'test.db');
const manifestPath = path.join(tempDir, 'manifest.json');

const MANIFEST = [
  {
    id: 'tcc-prueba',
    title: 'Terapia cognitivo-conductual (prueba)',
    summary: 'Resumen de prueba.',
    category: 'Modelos terapéuticos',
    kind: 'modelo',
    country: '',
    htmlPath: 'data/publicaciones-src/html/tcc.html',
    pdfPath: 'data/publicaciones/pdf/tcc.pdf',
    sources: ['OMS. CIE-11.', 'NICE NG222.'],
  },
  {
    id: 'normativa-mexico-prueba',
    title: 'Marco normativo de México (prueba)',
    summary: 'Resumen normativo.',
    category: 'Marcos normativos',
    kind: 'marco_normativo',
    country: 'México',
    htmlPath: 'data/publicaciones-src/html/normativa-mexico.html',
    pdfPath: '',
    sources: ['NOM-025-SSA2-2014.'],
  },
  // Entradas maliciosas/malformadas: deben descartarse al cargar.
  {
    id: 'escape-relativo',
    title: 'Escape con ..',
    summary: '',
    category: 'Temas clínicos',
    kind: 'tema',
    country: '',
    htmlPath: 'data/publicaciones-src/../../secreto.html',
    pdfPath: '',
    sources: [],
  },
  {
    id: 'escape-absoluto',
    title: 'Ruta absoluta externa',
    summary: '',
    category: 'Temas clínicos',
    kind: 'tema',
    country: '',
    htmlPath: path.join(os.tmpdir(), 'externo.html'),
    pdfPath: '',
    sources: [],
  },
  {
    id: '../id-invalido',
    title: 'Id con traversal',
    summary: '',
    category: 'Temas clínicos',
    kind: 'tema',
    country: '',
    htmlPath: 'data/publicaciones-src/html/ansiedad.html',
    pdfPath: '',
    sources: [],
  },
];

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqlitePublicationRepository: typeof import(
  '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository'
)['SqlitePublicationRepository'];
let LoadPublicationCatalog: typeof import(
  '@/contexts/library/application/load-publication-catalog/LoadPublicationCatalog'
)['LoadPublicationCatalog'];
let SearchPublications: typeof import(
  '@/contexts/library/application/search-publications/SearchPublications'
)['SearchPublications'];
let SearchPublicationsQuery: typeof import(
  '@/contexts/library/application/search-publications/SearchPublicationsQuery'
)['SearchPublicationsQuery'];
let TogglePublicationFavorite: typeof import(
  '@/contexts/library/application/toggle-publication-favorite/TogglePublicationFavorite'
)['TogglePublicationFavorite'];
let TogglePublicationFavoriteMessage: typeof import(
  '@/contexts/library/application/toggle-publication-favorite/TogglePublicationFavoriteMessage'
)['TogglePublicationFavoriteMessage'];
let MarkPublicationReviewed: typeof import(
  '@/contexts/library/application/mark-publication-reviewed/MarkPublicationReviewed'
)['MarkPublicationReviewed'];
let MarkPublicationReviewedMessage: typeof import(
  '@/contexts/library/application/mark-publication-reviewed/MarkPublicationReviewedMessage'
)['MarkPublicationReviewedMessage'];
let resolvePublicationAssetPath: typeof import(
  '@/contexts/library/infrastructure/filesystem/PublicationManifestReader'
)['resolvePublicationAssetPath'];
let favoriteUserA: string;
let favoriteUserB: string;

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.PUBLICACIONES_MANIFEST_PATH = manifestPath;
  // El catálogo CIE-11 no hace falta para este test (y ralentiza el seed).
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  fs.writeFileSync(manifestPath, JSON.stringify(MANIFEST), 'utf-8');

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqlitePublicationRepository } = await import(
    '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository'
  ));
  ({ LoadPublicationCatalog } = await import(
    '@/contexts/library/application/load-publication-catalog/LoadPublicationCatalog'
  ));
  ({ SearchPublications } = await import(
    '@/contexts/library/application/search-publications/SearchPublications'
  ));
  ({ SearchPublicationsQuery } = await import(
    '@/contexts/library/application/search-publications/SearchPublicationsQuery'
  ));
  ({ TogglePublicationFavorite } = await import(
    '@/contexts/library/application/toggle-publication-favorite/TogglePublicationFavorite'
  ));
  ({ TogglePublicationFavoriteMessage } = await import(
    '@/contexts/library/application/toggle-publication-favorite/TogglePublicationFavoriteMessage'
  ));
  ({ MarkPublicationReviewed } = await import(
    '@/contexts/library/application/mark-publication-reviewed/MarkPublicationReviewed'
  ));
  ({ MarkPublicationReviewedMessage } = await import(
    '@/contexts/library/application/mark-publication-reviewed/MarkPublicationReviewedMessage'
  ));
  ({ resolvePublicationAssetPath } = await import(
    '@/contexts/library/infrastructure/filesystem/PublicationManifestReader'
  ));
  const users = getDb()
    .prepare("SELECT id FROM users WHERE status = 'activo' ORDER BY id LIMIT 2")
    .all() as Array<{ id: string }>;
  if (!users[0] || !users[1]) throw new Error('El seed de prueba debe incluir dos usuarios activos.');
  favoriteUserA = users[0].id;
  favoriteUserB = users[1].id;
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    // ya cerrada
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  delete process.env.PUBLICACIONES_MANIFEST_PATH;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Carga del catálogo de publicaciones', () => {
  it('vuelca el manifest descartando entradas con rutas o ids peligrosos', async () => {
    const repository = new SqlitePublicationRepository();
    const result = await new LoadPublicationCatalog(repository).load();

    expect(result.loaded).toBe(2);
    expect(await repository.totalPublications()).toBe(2);
    expect(await repository.findById('escape-relativo')).toBeNull();
    expect(await repository.findById('escape-absoluto')).toBeNull();

    const tcc = await repository.findById('tcc-prueba');
    expect(tcc).not.toBeNull();
    expect(tcc?.toPrimitives().sources).toHaveLength(2);
  });

  it('recargar es idempotente y preserva favoritos por usuario y el sello compartido', async () => {
    const repository = new SqlitePublicationRepository(favoriteUserA);
    const otherUserRepository = new SqlitePublicationRepository(favoriteUserB);
    await new TogglePublicationFavorite(repository).toggle(
      new TogglePublicationFavoriteMessage({ publicationId: 'tcc-prueba' }),
    );
    expect((await repository.findById('tcc-prueba'))?.toPrimitives().favorite).toBe(true);
    expect((await otherUserRepository.findById('tcc-prueba'))?.toPrimitives().favorite).toBe(false);
    expect(await repository.countFavorites()).toBe(1);
    expect(await otherUserRepository.countFavorites()).toBe(0);

    const sello = await new MarkPublicationReviewed(repository).mark(
      new MarkPublicationReviewedMessage({ publicationId: 'tcc-prueba' }),
    );
    expect(sello.reviewed).toBe(true);
    expect(sello.reviewedAt).not.toBeNull();

    const again = await new LoadPublicationCatalog(repository).load();
    expect(again.loaded).toBe(0);
    expect(again.updated).toBe(2);
    expect(await repository.totalPublications()).toBe(2);
    const tras = (await repository.findById('tcc-prueba'))?.toPrimitives();
    expect(tras?.favorite).toBe(true);
    expect(tras?.reviewed).toBe(true);
    expect(tras?.reviewedAt).toBe(sello.reviewedAt);
    expect((await otherUserRepository.findById('tcc-prueba'))?.toPrimitives().reviewed).toBe(true);
  });

  it('busca por categoría, país y favoritos aislados por usuario', async () => {
    const repository = new SqlitePublicationRepository(favoriteUserA);
    const search = new SearchPublications(repository);

    const normativos = await search.search(
      SearchPublicationsQuery.fromPrimitives({ category: 'Marcos normativos', country: 'México' }),
    );
    expect(normativos.total).toBe(1);
    expect(normativos.publications[0]?.id).toBe('normativa-mexico-prueba');

    const favoritos = await search.search(SearchPublicationsQuery.fromPrimitives({ onlyFavorites: true }));
    expect(favoritos.publications.map((publication) => publication.id)).toEqual(['tcc-prueba']);
    const otherUserFavorites = await new SearchPublications(
      new SqlitePublicationRepository(favoriteUserB),
    ).search(SearchPublicationsQuery.fromPrimitives({ onlyFavorites: true }));
    expect(otherUserFavorites.publications).toEqual([]);

    // El país solo filtra dentro de una categoría seleccionada.
    const sinCategoria = await search.search(SearchPublicationsQuery.fromPrimitives({ country: 'México' }));
    expect(sinCategoria.total).toBe(2);
  });
});

describe('Resolución segura de rutas de publicaciones', () => {
  it('acepta rutas dentro de las carpetas de publicaciones', () => {
    expect(resolvePublicationAssetPath('data/publicaciones-src/html/tcc.html')).toBe(
      path.resolve(process.cwd(), 'data/publicaciones-src/html/tcc.html'),
    );
    expect(resolvePublicationAssetPath('data/publicaciones/pdf/tcc.pdf')).toBe(
      path.resolve(process.cwd(), 'data/publicaciones/pdf/tcc.pdf'),
    );
  });

  it('rechaza traversal, rutas absolutas externas y vacíos', () => {
    expect(resolvePublicationAssetPath('data/publicaciones-src/../../otro/archivo.html')).toBeNull();
    expect(resolvePublicationAssetPath('../escuchainterna.db')).toBeNull();
    expect(resolvePublicationAssetPath(path.join(os.tmpdir(), 'externo.html'))).toBeNull();
    expect(resolvePublicationAssetPath('data/escuchainterna.db')).toBeNull();
    expect(resolvePublicationAssetPath('')).toBeNull();
    expect(resolvePublicationAssetPath('data/publicaciones-src')).toBeNull();
  });
});
