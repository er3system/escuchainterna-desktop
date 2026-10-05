import fs from 'node:fs';
import path from 'node:path';

export interface ScannedBookFile {
  title: string;
  author: string;
  category: string;
  subcategory: string;
  relativePath: string;
  extension: string;
  sizeBytes: number;
}

const INDEXABLE_EXTENSIONS = new Set(['.pdf', '.epub', '.doc', '.docx', '.txt', '.pptx', '.xls']);

export function libraryRootPath(): string {
  return path.resolve(process.cwd(), process.env.BIBLIOTECA_PATH ?? './data/biblioteca');
}

/** Recorre la carpeta de la biblioteca (solo lectura) y extrae metadatos de cada archivo. */
export function scanLibraryFolder(): ScannedBookFile[] {
  const root = libraryRootPath();
  if (!fs.existsSync(root)) return [];
  const results: ScannedBookFile[] = [];
  walk(root, root, results);
  return results;
}

function walk(root: string, dir: string, results: ScannedBookFile[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(root, fullPath, results);
      continue;
    }
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if (!INDEXABLE_EXTENSIONS.has(extension)) continue;
    const relativePath = path.relative(root, fullPath).split(path.sep).join('/');
    const segments = relativePath.split('/');
    const category = segments.length > 1 ? segments[0] : 'Sin categoría';
    const subcategory = segments.length > 2 ? segments.slice(1, -1).join(' / ') : '';
    const { title, author } = parseTitleAndAuthor(path.basename(entry.name, path.extname(entry.name)));
    results.push({
      title,
      author,
      category,
      subcategory,
      relativePath,
      extension,
      sizeBytes: fs.statSync(fullPath).size,
    });
  }
}

/**
 * Heurística sobre nombres de archivo reales de la colección:
 * "La criminología - Tamarit Sumalla, Josep M" → título - autor.
 * Nombres con guiones bajos o sin separador se limpian y quedan sin autor.
 */
function parseTitleAndAuthor(baseName: string): { title: string; author: string } {
  let clean = baseName.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').replace(/\.PDF$/i, '').trim();
  const separatorMatch = clean.match(/^(.{4,}?)\s*-\s*(.{3,})$/);
  if (separatorMatch) {
    const left = separatorMatch[1].trim();
    const right = separatorMatch[2].trim();
    const rightWords = right.split(/\s+/).length;
    const looksLikeAuthor = rightWords <= 5 && /^[\p{L}\s,.']+$/u.test(right) && !/^\d/.test(right);
    if (looksLikeAuthor) return { title: left, author: right };
  }
  return { title: clean, author: '' };
}
