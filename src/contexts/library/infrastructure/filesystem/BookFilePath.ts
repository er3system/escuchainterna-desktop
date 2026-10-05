import fs from 'node:fs';
import path from 'node:path';
import { libraryRootPath } from './LibraryFolderScanner';

/** Un registro del índice nunca autoriza leer fuera del catálogo instalado. */
export function resolveBookFilePath(relativePath: string): string | null {
  const root = path.resolve(libraryRootPath());
  const candidate = path.resolve(root, relativePath);
  if (!candidate.startsWith(root + path.sep)) return null;
  try {
    const realRoot = fs.realpathSync(root);
    const actual = fs.realpathSync(candidate);
    return actual.startsWith(realRoot + path.sep) && fs.statSync(actual).isFile() ? actual : null;
  } catch { return null; }
}
