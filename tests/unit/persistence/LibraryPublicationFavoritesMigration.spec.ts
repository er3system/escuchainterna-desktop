import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  LATEST_SCHEMA_VERSION,
  runMigrations,
} from '@/shared/infrastructure/persistence/migrations';

describe('migración de favoritos de publicaciones por usuario', () => {
  it('crea la relación aislada sin atribuir favoritos globales legacy', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('PRAGMA foreign_keys = ON');
      db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, status TEXT NOT NULL)');
      // Extremos clínicos existentes en v59; las migraciones posteriores también
      // mantienen referencias al borrar una cuenta.
      db.exec('CREATE TABLE patients (id TEXT PRIMARY KEY)');
      db.exec('CREATE TABLE patient_consents (id TEXT PRIMARY KEY)');
      db.exec(`CREATE TABLE library_publications (
        id TEXT PRIMARY KEY,
        favorite INTEGER NOT NULL DEFAULT 0
      )`);
      db.exec(`INSERT INTO users (id, status) VALUES
        ('user-a', 'activo'),
        ('user-b', 'activo')`);
      db.exec("INSERT INTO library_publications (id, favorite) VALUES ('publication-a', 1)");
      db.exec('PRAGMA user_version = 59');

      runMigrations(db);

      const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
      expect(version.user_version).toBe(LATEST_SCHEMA_VERSION);
      expect(LATEST_SCHEMA_VERSION).toBeGreaterThanOrEqual(60);

      // El favorito global no permite saber quién lo creó: v60 no fabrica
      // preferencias para todos los usuarios ni las asigna arbitrariamente.
      expect(
        db.prepare('SELECT * FROM library_publication_favorites').all(),
      ).toEqual([]);

      db.prepare(
        `INSERT INTO library_publication_favorites (user_id, publication_id, created_at)
         VALUES (?, ?, ?)`,
      ).run('user-a', 'publication-a', '2026-07-22T00:00:00.000Z');

      expect(
        db
          .prepare(
            `SELECT user_id, publication_id
               FROM library_publication_favorites ORDER BY user_id`,
          )
          .all(),
      ).toEqual([{ user_id: 'user-a', publication_id: 'publication-a' }]);
      expect(() =>
        db
          .prepare(
            `INSERT INTO library_publication_favorites (user_id, publication_id, created_at)
             VALUES (?, ?, ?)`,
          )
          .run('user-a', 'publication-a', '2026-07-22T00:00:01.000Z'),
      ).toThrow();

      db.prepare("DELETE FROM users WHERE id = 'user-a'").run();
      expect(
        db.prepare('SELECT COUNT(*) AS total FROM library_publication_favorites').get(),
      ).toEqual({ total: 0 });
    } finally {
      db.close();
    }
  });
});
