import fs from 'node:fs';
import path from 'node:path';
import type { PublicationKind } from '../../domain/Publication';

/**
 * Lector del manifest de la Colección EscuchaInterna
 * (data/publicaciones/manifest.json, generado por los agentes de contenido).
 */
export interface PublicationManifestEntry {
  id: string;
  title: string;
  summary: string;
  category: string;
  kind: PublicationKind;
  country: string;
  htmlPath: string;
  pdfPath: string;
  sources: string[];
}

const PUBLICATION_KINDS: ReadonlySet<string> = new Set(['modelo', 'tema', 'marco_normativo']);

export function publicationsManifestPath(): string {
  return path.resolve(process.cwd(), process.env.PUBLICACIONES_MANIFEST_PATH ?? './data/publicaciones/manifest.json');
}

export function publicationsManifestExists(): boolean {
  return fs.existsSync(publicationsManifestPath());
}

/** Raíces permitidas para los archivos de las publicaciones (HTML y PDF). */
function allowedAssetRoots(): string[] {
  return [
    path.resolve(process.cwd(), './data/publicaciones-src'),
    path.resolve(process.cwd(), './data/publicaciones'),
  ];
}

/**
 * Resuelve una ruta del registro (relativa al proyecto, p. ej.
 * "data/publicaciones-src/html/tcc.html") a una ruta absoluta SOLO si queda
 * dentro de las carpetas de publicaciones. Devuelve null ante cualquier intento
 * de escape (path traversal, rutas absolutas externas, etc.).
 */
export function resolvePublicationAssetPath(storedPath: string): string | null {
  if (!storedPath || storedPath.trim() === '') return null;
  const absolute = path.resolve(process.cwd(), storedPath);
  const insideAllowedRoot = allowedAssetRoots().some((root) => absolute.startsWith(root + path.sep));
  return insideAllowedRoot ? absolute : null;
}

/**
 * Lee y valida el manifest. Las entradas malformadas o con rutas fuera de las
 * carpetas permitidas se descartan en silencio (el catálogo nunca registra
 * rutas peligrosas). Si el manifest no existe o no es un arreglo, devuelve [].
 */
export function readPublicationsManifest(): PublicationManifestEntry[] {
  const manifestPath = publicationsManifestPath();
  if (!fs.existsSync(manifestPath)) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const entries: PublicationManifestEntry[] = [];
  for (const raw of parsed) {
    const entry = normalizeEntry(raw);
    if (entry) entries.push(entry);
  }
  return entries;
}

function normalizeEntry(raw: unknown): PublicationManifestEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;

  const id = asString(record.id);
  const title = asString(record.title);
  const category = asString(record.category);
  const htmlPath = asString(record.htmlPath);
  if (!id || !title || !category || !htmlPath) return null;
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) return null;

  // Las rutas deben quedar dentro de las carpetas de publicaciones.
  if (resolvePublicationAssetPath(htmlPath) === null) return null;
  const pdfPath = asString(record.pdfPath);
  if (pdfPath && resolvePublicationAssetPath(pdfPath) === null) return null;

  const kindRaw = asString(record.kind);
  const kind: PublicationKind = PUBLICATION_KINDS.has(kindRaw) ? (kindRaw as PublicationKind) : 'tema';

  const sources = Array.isArray(record.sources)
    ? record.sources.filter((source): source is string => typeof source === 'string' && source.trim() !== '')
    : [];

  return {
    id,
    title,
    summary: asString(record.summary),
    category,
    kind,
    country: asString(record.country),
    htmlPath,
    pdfPath,
    sources,
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
