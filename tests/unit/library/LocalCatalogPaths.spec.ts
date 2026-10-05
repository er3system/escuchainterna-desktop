import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePublicationAssetPath, readPublicationsManifest } from '@/contexts/library/infrastructure/filesystem/PublicationManifestReader';
import { resolveBookFilePath } from '@/contexts/library/infrastructure/filesystem/BookFilePath';
import { scanLibraryFolder } from '@/contexts/library/infrastructure/filesystem/LibraryFolderScanner';

describe('catálogos instalados fuera del espacio clínico', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'ei-catalog-')); vi.stubEnv('PUBLICACIONES_ROOT_PATH', root); vi.stubEnv('BIBLIOTECA_PATH', path.join(root, 'biblioteca')); fs.mkdirSync(path.join(root, 'data/publicaciones-src/html'), { recursive: true }); fs.mkdirSync(path.join(root, 'data/publicaciones'), { recursive: true }); fs.mkdirSync(path.join(root, 'biblioteca/Clínica'), { recursive: true }); });
  afterEach(() => { vi.unstubAllEnvs(); fs.rmSync(root, { recursive: true, force: true }); });
  it('resuelve HTML instalado y descarta escapes del manifest', () => {
    const html = path.join(root, 'data/publicaciones-src/html/lectura.html'); fs.writeFileSync(html, '<main class="content">Lectura</main>');
    expect(resolvePublicationAssetPath('data/publicaciones-src/html/lectura.html')).toBe(fs.realpathSync(html));
    expect(resolvePublicationAssetPath('data/publicaciones-src/../../externo.html')).toBeNull();
    const manifest = path.join(root, 'data/publicaciones/manifest.json'); vi.stubEnv('PUBLICACIONES_MANIFEST_PATH', manifest);
    fs.writeFileSync(manifest, JSON.stringify([{ id: 'lectura', title: 'Lectura', category: 'Temas clínicos', htmlPath: 'data/publicaciones-src/html/lectura.html' }, { id: 'escape', title: 'Escape', category: 'Temas clínicos', htmlPath: '../fuera.html' }]));
    expect(readPublicationsManifest().map(entry => entry.id)).toEqual(['lectura']);
  });
  it('indexa archivos y solo sirve archivos regulares dentro de libros', () => {
    const book = path.join(root, 'biblioteca/Clínica/Guía - Autora.pdf'); fs.writeFileSync(book, 'PDF de prueba');
    expect(scanLibraryFolder()).toMatchObject([{ title: 'Guía', author: 'Autora', category: 'Clínica' }]);
    expect(resolveBookFilePath('Clínica/Guía - Autora.pdf')).toBe(fs.realpathSync(book));
    expect(resolveBookFilePath('../externo.pdf')).toBeNull(); expect(resolveBookFilePath('Clínica')).toBeNull();
  });
  it('rechaza un enlace de directorio que conduce fuera del catálogo', () => {
    const outside = path.join(root, 'externo'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secreto.pdf'), 'fuera');
    fs.symlinkSync(outside, path.join(root, 'biblioteca/escape'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(resolveBookFilePath('escape/secreto.pdf')).toBeNull();
    expect(scanLibraryFolder()).toEqual([]);
  });
});
