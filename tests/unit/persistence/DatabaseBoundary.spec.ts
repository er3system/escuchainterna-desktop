import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('frontera de persistencia', () => {
  it('solo el adaptador SQLite importa la conexión concreta', () => {
    const root = resolve(process.cwd(), 'src');
    const concreteConnectionImport = /from\s+['"][^'"]*SqliteConnection['"]/;
    const importers = sourceFiles(root)
      .filter((file) => concreteConnectionImport.test(readFileSync(file, 'utf8')))
      .map((file) => relative(root, file).replaceAll('\\', '/'));

    expect(importers).toEqual(['shared/infrastructure/persistence/SqliteAdapter.ts']);
  });
});
