import { Cie11Catalog, Cie11Entry } from '../../domain/repositories/Cie11Catalog';

export interface Cie11SearchResult {
  results: Cie11Entry[];
  /** Para cada resultado, la ruta de ancestros (del capítulo hacia abajo) que lo contextualiza. */
  breadcrumbs: Record<string, Cie11Entry[]>;
}

export class SearchCie11 {
  public constructor(private readonly catalog: Cie11Catalog) {}

  public async search(text: string, limit = 30): Promise<Cie11SearchResult> {
    const results = await this.catalog.searchByText(text.trim(), limit);
    const breadcrumbs: Record<string, Cie11Entry[]> = {};
    for (const entry of results) {
      breadcrumbs[entry.code] = await this.catalog.ancestorsOf(entry.code);
    }
    return { results, breadcrumbs };
  }

  public async childrenOf(parentCode: string | null, chapter: string): Promise<Cie11Entry[]> {
    return this.catalog.childrenOf(parentCode, chapter);
  }
}
