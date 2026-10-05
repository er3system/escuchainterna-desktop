import { describe, expect, it } from 'vitest';
import { catalogUrl, readCatalogLocation } from '@/app/(app)/biblioteca/libros/catalogNavigation';

describe('Navegación del catálogo local', () => {
  it('conserva título, categoría y página sin confundir los caracteres con parámetros', () => {
    const original = { q: 'Freud & vínculo? #1', category: 'Clínica / adultos', page: 2 };
    const url = new URL(catalogUrl(original), 'https://local.test');
    expect(url.pathname).toBe('/biblioteca/libros');
    expect(readCatalogLocation(Object.fromEntries(url.searchParams))).toEqual(original);
    expect([...url.searchParams.keys()]).toEqual(['pagina', 'q', 'categoria']);
  });
  it.each(['-1', '0', '1.5', 'Infinity', 'NaN', ''])('normaliza páginas no utilizables: %s', pagina => {
    expect(readCatalogLocation({ pagina }).page).toBe(1);
  });
  it('limita páginas excesivas y toma solo el primer valor de filtros repetidos', () => {
    expect(readCatalogLocation({ pagina: '999999', q: [' ansiedad ', 'otro'], categoria: [' Clínica ', 'otra'] })).toEqual({ page: 100000, q: 'ansiedad', category: 'Clínica' });
  });
  it('ignora destinos externos suministrados en la URL del lector', () => {
    const result = catalogUrl(readCatalogLocation({ volver: 'https://example.test', q: '//example.test', pagina: '2' }));
    expect(new URL(result, 'https://local.test').origin).toBe('https://local.test');
    expect(result).not.toContain('volver');
  });
});
