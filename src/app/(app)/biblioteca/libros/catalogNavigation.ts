/** URLs del catálogo: solo filtros y página; nunca destinos externos. */
export type CatalogSearchParams = Record<string, string | string[] | undefined>;
export interface CatalogLocation { q: string; category: string; page: number }
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';

export function readCatalogLocation(params: CatalogSearchParams): CatalogLocation {
  const requestedPage = Number(first(params.pagina));
  return {
    q: first(params.q).trim(),
    category: first(params.categoria).trim(),
    page: Number.isSafeInteger(requestedPage) ? Math.min(100000, Math.max(1, requestedPage)) : 1,
  };
}

export function catalogQuery({ q, category, page }: CatalogLocation): string {
  const query = new URLSearchParams({ pagina: String(page) });
  if (q) query.set('q', q);
  if (category) query.set('categoria', category);
  return query.toString();
}

export function catalogUrl(location: CatalogLocation): string {
  return `/biblioteca/libros?${catalogQuery(location)}`;
}
