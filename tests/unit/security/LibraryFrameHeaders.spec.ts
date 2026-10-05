import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const book = '/api/biblioteca/65cc4c7d-4d2e-4e4d-a7d0-c7a8d42895f0/file';
const headers = (pathname: string) => middleware(new NextRequest(`http://127.0.0.1:3000${pathname}`)).headers;

describe('Cabeceras del lector local de libros', () => {
  it('permite incrustar archivos de biblioteca solo desde el mismo origen', () => {
    const result = headers(book);
    expect(result.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(result.get('Content-Security-Policy')).toContain("frame-ancestors 'self'");
    expect(result.get('X-Content-Type-Options')).toBe('nosniff');
  });
  it('conserva la prohibición de incrustar pantallas y endpoints ajenos al lector', () => {
    for (const pathname of ['/pacientes', '/biblioteca/libros', '/api/pacientes/65cc4c7d-4d2e-4e4d-a7d0-c7a8d42895f0/file', `${book}/extra`, '/api/biblioteca/incorrecto/file']) {
      expect(headers(pathname).get('X-Frame-Options')).toBe('DENY');
      expect(headers(pathname).get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    }
  });
  it('mantiene las restricciones de scripts, objetos y envío de formularios', () => {
    const csp = headers(book).get('Content-Security-Policy');
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
  });
});
