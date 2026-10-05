import { describe, it, expect } from 'vitest';
import { extractPublicationContent } from '@/contexts/library/infrastructure/filesystem/HtmlPublicationContentReader';
import { ReadPublication } from '@/contexts/library/application/read-publication/ReadPublication';
import { ReadPublicationMessage } from '@/contexts/library/application/read-publication/ReadPublicationMessage';
import { PublicationNotFoundError } from '@/contexts/library/domain/errors/PublicationNotFoundError';
import { InvalidPublicationIdError } from '@/contexts/library/domain/value-objects/PublicationId';
import { Publication, PublicationPrimitives } from '@/contexts/library/domain/Publication';
import { PublicationContent } from '@/contexts/library/domain/PublicationContent';
import {
  PublicationRepository,
  PublicationSearchCriteria,
} from '@/contexts/library/domain/repositories/PublicationRepository';
import { PublicationContentReader } from '@/contexts/library/domain/repositories/PublicationContentReader';

/**
 * Lector web de la Colección EscuchaInterna:
 * - la extracción recorta SOLO el cuerpo (<main class="content">), sin portada
 *   de imprenta ni pie del PDF, y elimina <script> por si los hubiera;
 * - los h1/h2 reciben anclas únicas y forman el índice de contenidos;
 * - las tablas se envuelven para el scroll horizontal del lector;
 * - el caso de uso devuelve metadatos + contenido y falla con error de dominio
 *   si la publicación no existe o el id es inválido.
 */

const RAW_HTML = `<!DOCTYPE html>
<html lang="es">
<head><title>Doc</title><style>.cover { color: red; }</style></head>
<body>
<section class="cover">
  <h1 class="cover-title">Portada gigante</h1>
  <p class="cover-subtitle">Subtítulo de imprenta</p>
</section>
<main class="content">
<p class="lead">Entradilla del documento.</p>
<h1>1. Orígenes del modelo</h1>
<p>Primer párrafo.</p>
<h2>Evaluación inicial</h2>
<p>Texto con <strong>énfasis</strong>.</p>
<h2>Evaluación inicial</h2>
<table><tr><th>Columna</th></tr><tr><td>Dato</td></tr></table>
<script>alert('nunca');</script>
<section class="sources no-break">
  <h1>Fuentes y lecturas recomendadas</h1>
  <ol><li>OMS. CIE-11.</li></ol>
</section>
<div class="doc-footer">
  Pie del PDF que no debe verse en pantalla.<br>
  © EscuchaInterna.
</div>
</main>
</body>
</html>`;

describe('Extracción del contenido legible', () => {
  const content = extractPublicationContent(RAW_HTML);

  it('recorta solo el cuerpo: sin portada, sin pie del PDF y sin scripts', () => {
    expect(content).not.toBeNull();
    expect(content?.html).toContain('Entradilla del documento.');
    expect(content?.html).toContain('Fuentes y lecturas recomendadas');
    expect(content?.html).not.toContain('Portada gigante');
    expect(content?.html).not.toContain('cover-subtitle');
    expect(content?.html).not.toContain('doc-footer');
    expect(content?.html).not.toContain('Pie del PDF');
    expect(content?.html).not.toContain('<script');
    expect(content?.html).not.toContain('alert(');
  });

  it('inyecta anclas únicas en h1/h2 y devuelve el índice de contenidos', () => {
    expect(content?.headings).toEqual([
      { id: '1-origenes-del-modelo', text: '1. Orígenes del modelo', level: 1 },
      { id: 'evaluacion-inicial', text: 'Evaluación inicial', level: 2 },
      { id: 'evaluacion-inicial-2', text: 'Evaluación inicial', level: 2 },
      { id: 'fuentes-y-lecturas-recomendadas', text: 'Fuentes y lecturas recomendadas', level: 1 },
    ]);
    expect(content?.html).toContain('<h1 id="1-origenes-del-modelo">');
    expect(content?.html).toContain('<h2 id="evaluacion-inicial">');
    expect(content?.html).toContain('<h2 id="evaluacion-inicial-2">');
  });

  it('envuelve las tablas para el scroll horizontal del lector', () => {
    expect(content?.html).toContain('<div class="lector-tabla"><table>');
    expect(content?.html).toContain('</table></div>');
  });

  it('devuelve null si el documento no tiene <main class="content">', () => {
    expect(extractPublicationContent('<html><body><p>Sin main</p></body></html>')).toBeNull();
    expect(extractPublicationContent('<main class="content"><p>sin cierre')).toBeNull();
  });
});

// ---- Caso de uso ReadPublication con dobles en memoria ----

function buildPublication(overrides: Partial<PublicationPrimitives> = {}): Publication {
  return Publication.fromPrimitives({
    id: 'tcc',
    title: 'Terapia cognitivo-conductual',
    summary: 'Resumen.',
    category: 'Modelos terapéuticos',
    kind: 'modelo',
    country: '',
    htmlPath: 'data/publicaciones-src/html/tcc.html',
    pdfPath: 'data/publicaciones/pdf/tcc.pdf',
    sources: ['OMS. CIE-11.'],
    favorite: false,
    publishedAt: new Date('2026-06-01').toISOString(),
    ...overrides,
  });
}

class InMemoryPublicationRepository implements PublicationRepository {
  private readonly publications = new Map<string, Publication>();

  public async save(publication: Publication): Promise<void> {
    this.publications.set(publication.toPrimitives().id, publication);
  }
  public async addToFavorites(publication: Publication): Promise<void> {
    publication.markAsFavorite();
  }
  public async removeFromFavorites(publication: Publication): Promise<void> {
    publication.unmarkAsFavorite();
  }
  public async findById(id: string): Promise<Publication | null> {
    return this.publications.get(id) ?? null;
  }
  public async search(_criteria: PublicationSearchCriteria): Promise<Publication[]> {
    return [...this.publications.values()];
  }
  public async countMatching(_criteria: PublicationSearchCriteria): Promise<number> {
    return this.publications.size;
  }
  public async listCategories(): Promise<Array<{ category: string; total: number }>> {
    return [];
  }
  public async listCountries(_category: string): Promise<Array<{ country: string; total: number }>> {
    return [];
  }
  public async totalPublications(): Promise<number> {
    return this.publications.size;
  }
  public async countFavorites(): Promise<number> {
    return 0;
  }
}

class StubContentReader implements PublicationContentReader {
  public constructor(private readonly content: PublicationContent | null) {}
  public lastPathRead: string | null = null;

  public async read(htmlPath: string): Promise<PublicationContent | null> {
    this.lastPathRead = htmlPath;
    return this.content;
  }
}

describe('ReadPublication (caso de uso del lector)', () => {
  it('devuelve los metadatos y el contenido extraído de la ruta registrada', async () => {
    const repository = new InMemoryPublicationRepository();
    await repository.save(buildPublication());
    const reader = new StubContentReader({
      html: '<p>Cuerpo</p>',
      headings: [{ id: 'seccion', text: 'Sección', level: 1 }],
    });

    const result = await new ReadPublication(repository, reader).read(
      new ReadPublicationMessage({ publicationId: 'tcc' }),
    );

    expect(result.publication.title).toBe('Terapia cognitivo-conductual');
    expect(result.content?.html).toBe('<p>Cuerpo</p>');
    expect(result.content?.headings).toHaveLength(1);
    expect(reader.lastPathRead).toBe('data/publicaciones-src/html/tcc.html');
  });

  it('devuelve content null cuando el archivo aún no está disponible', async () => {
    const repository = new InMemoryPublicationRepository();
    await repository.save(buildPublication());

    const result = await new ReadPublication(repository, new StubContentReader(null)).read(
      new ReadPublicationMessage({ publicationId: 'tcc' }),
    );

    expect(result.publication.id).toBe('tcc');
    expect(result.content).toBeNull();
  });

  it('falla con errores de dominio ante publicaciones inexistentes o ids inválidos', async () => {
    const repository = new InMemoryPublicationRepository();
    const useCase = new ReadPublication(repository, new StubContentReader(null));

    await expect(
      useCase.read(new ReadPublicationMessage({ publicationId: 'no-existe' })),
    ).rejects.toThrow(PublicationNotFoundError);
    expect(() => new ReadPublicationMessage({ publicationId: '../escape' })).toThrow(
      InvalidPublicationIdError,
    );
  });
});
