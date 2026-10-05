import { Publication } from '../../domain/Publication';
import { PublicationRepository } from '../../domain/repositories/PublicationRepository';
import { readPublicationsManifest } from '../../infrastructure/filesystem/PublicationManifestReader';

export interface LoadPublicationCatalogResult {
  loaded: number;
  updated: number;
  total: number;
}

/**
 * Vuelca el manifest de la Colección EscuchaInterna a library_publications.
 * Es idempotente: las publicaciones existentes se actualizan (título, resumen,
 * rutas, fuentes) PRESERVANDO la fecha de publicación y el sello de revisión
 * del equipo clínico. Los favoritos viven en su propia relación por usuario
 * y esta carga no los lee ni los modifica.
 */
export class LoadPublicationCatalog {
  public constructor(private readonly repository: PublicationRepository) {}

  public async load(): Promise<LoadPublicationCatalogResult> {
    const entries = readPublicationsManifest();
    let loaded = 0;
    let updated = 0;

    for (const entry of entries) {
      const existing = (await this.repository.findById(entry.id))?.toPrimitives();
      const publication = Publication.fromPrimitives({
        id: entry.id,
        title: entry.title,
        summary: entry.summary,
        category: entry.category,
        kind: entry.kind,
        country: entry.country,
        htmlPath: entry.htmlPath,
        pdfPath: entry.pdfPath,
        sources: entry.sources,
        favorite: false,
        publishedAt: existing?.publishedAt ?? new Date().toISOString(),
        reviewed: existing?.reviewed ?? false,
        reviewedAt: existing?.reviewedAt ?? null,
      });
      await this.repository.save(publication);
      if (existing) updated += 1;
      else loaded += 1;
    }

    return { loaded, updated, total: await this.repository.totalPublications() };
  }
}
