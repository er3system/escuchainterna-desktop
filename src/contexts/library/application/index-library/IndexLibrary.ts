import { randomUUID } from 'node:crypto';
import { Book } from '../../domain/Book';
import { BookRepository } from '../../domain/repositories/BookRepository';
import { scanLibraryFolder } from '../../infrastructure/filesystem/LibraryFolderScanner';

export interface IndexLibraryResult {
  indexed: number;
  total: number;
}

export class IndexLibrary {
  public constructor(private readonly repository: BookRepository) {}

  public async index(): Promise<IndexLibraryResult> {
    const scanned = scanLibraryFolder();
    let indexed = 0;
    for (const file of scanned) {
      const existing = await this.repository.findByRelativePath(file.relativePath);
      if (existing) continue;
      const book = Book.fromPrimitives({
        id: randomUUID(),
        title: file.title,
        author: file.author,
        category: file.category,
        subcategory: file.subcategory,
        relativePath: file.relativePath,
        extension: file.extension,
        sizeBytes: file.sizeBytes,
        favorite: false,
        indexedAt: new Date().toISOString(),
      });
      await this.repository.save(book);
      indexed += 1;
    }
    return { indexed, total: await this.repository.totalBooks() };
  }
}
