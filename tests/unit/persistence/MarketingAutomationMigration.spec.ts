import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { runMigrations } from '@/shared/infrastructure/persistence/migrations';

describe('migración de automatizaciones de marketing por propietario', () => {
  it('copia la configuración legacy a cada owner y cambia la unicidad a owner + kind', () => {
    const db = new DatabaseSync(':memory:');
    try {
      db.exec('PRAGMA foreign_keys = ON');
      db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT NOT NULL)`);
      db.exec(`CREATE TABLE marketing_automations (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 0,
        interval_months INTEGER,
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        owner_user_id TEXT
      )`);
      db.exec(`INSERT INTO users (id, role) VALUES
        ('owner-a', 'psychologist'),
        ('owner-b', 'org_master'),
        ('platform-admin', 'admin')`);
      db.exec(`INSERT INTO marketing_automations
        (id, kind, enabled, interval_months, subject, body, owner_user_id) VALUES
        ('legacy-birthday', 'cumpleanios', 1, NULL, 'Asunto legacy', 'Cuerpo legacy', NULL),
        ('legacy-reactivation', 'reactivacion', 0, 9, 'Regresa', 'Te esperamos', NULL)`);
      db.exec('PRAGMA user_version = 58');

      runMigrations(db);

      const rows = db
        .prepare(
          `SELECT owner_user_id, kind, enabled, interval_months, subject
             FROM marketing_automations ORDER BY owner_user_id, kind`,
        )
        .all();
      expect(rows).toEqual([
        {
          owner_user_id: 'owner-a',
          kind: 'cumpleanios',
          enabled: 1,
          interval_months: null,
          subject: 'Asunto legacy',
        },
        {
          owner_user_id: 'owner-a',
          kind: 'reactivacion',
          enabled: 0,
          interval_months: 9,
          subject: 'Regresa',
        },
        {
          owner_user_id: 'owner-b',
          kind: 'cumpleanios',
          enabled: 1,
          interval_months: null,
          subject: 'Asunto legacy',
        },
        {
          owner_user_id: 'owner-b',
          kind: 'reactivacion',
          enabled: 0,
          interval_months: 9,
          subject: 'Regresa',
        },
      ]);
      expect(rows.some((row) => row.owner_user_id === 'platform-admin')).toBe(false);

      const ownerColumn = db
        .prepare(`PRAGMA table_info('marketing_automations')`)
        .all()
        .find((column) => column.name === 'owner_user_id');
      expect(ownerColumn).toMatchObject({ notnull: 1 });
      expect(() =>
        db
          .prepare(
            `INSERT INTO marketing_automations
              (id, owner_user_id, kind, enabled, interval_months, subject, body)
             VALUES ('duplicate', 'owner-a', 'cumpleanios', 0, NULL, '', '')`,
          )
          .run(),
      ).toThrow();
    } finally {
      db.close();
    }
  });
});
