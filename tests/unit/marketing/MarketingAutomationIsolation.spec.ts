import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UpdateAutomation } from '@/contexts/marketing/application/update-automation/UpdateAutomation';
import { UpdateAutomationMessage } from '@/contexts/marketing/application/update-automation/UpdateAutomationMessage';
import { RunDueAutomations } from '@/contexts/marketing/application/run-due-automations/RunDueAutomations';
import type {
  EmailDispatcher,
  MarketingEmail,
} from '@/contexts/marketing/domain/EmailDispatcher';
import type { AutomationDeliveryLog } from '@/contexts/marketing/domain/repositories/AutomationDeliveryLog';
import type {
  MarketingRecipient,
  RecipientDirectory,
  SegmentationRecipient,
} from '@/contexts/marketing/domain/repositories/RecipientDirectory';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'escuchainterna-marketing-automation-'));
const dbPath = path.join(tempDir, 'test.db');
const OWNER_A = `marketing-a-${randomUUID()}`;
const OWNER_B = `marketing-b-${randomUUID()}`;

let getDb: typeof import('@/shared/infrastructure/persistence/SqliteConnection')['getDb'];
let SqliteMarketingAutomationRepository: typeof import('@/contexts/marketing/infrastructure/persistence/SqliteMarketingAutomationRepository')['SqliteMarketingAutomationRepository'];

const RECIPIENT: MarketingRecipient = {
  id: 'patient-birthday',
  fullName: 'Paciente Cumpleaños',
  email: 'paciente@example.test',
  phone: '',
  birthDate: '1990-07-22',
  lastSessionAt: null,
};

class BirthdayRecipientDirectory implements RecipientDirectory {
  public async listAll(): Promise<MarketingRecipient[]> {
    return [RECIPIENT];
  }

  public async search(): Promise<MarketingRecipient[]> {
    return [RECIPIENT];
  }

  public async findByIds(): Promise<MarketingRecipient[]> {
    return [RECIPIENT];
  }

  public async listWithBirthdayOn(): Promise<MarketingRecipient[]> {
    return [RECIPIENT];
  }

  public async listInactiveSince(): Promise<MarketingRecipient[]> {
    return [];
  }

  public async listForSegmentation(): Promise<SegmentationRecipient[]> {
    return [{ ...RECIPIENT, gender: '', archived: false, tags: [] }];
  }
}

class EmptyDeliveryLog implements AutomationDeliveryLog {
  public async wasBirthdayGreetingSentThisYear(): Promise<boolean> {
    return false;
  }

  public async wasReactivationSentSince(): Promise<boolean> {
    return false;
  }
}

class RecordingDispatcher implements EmailDispatcher {
  public readonly emails: MarketingEmail[] = [];

  public async dispatch(email: MarketingEmail): Promise<void> {
    this.emails.push(email);
  }
}

beforeAll(async () => {
  process.env.DATABASE_PATH = dbPath;
  process.env.CIE11_DATASET_PATH = path.join(tempDir, 'no-existe.json');
  delete process.env.DATABASE_URL;
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  delete (globalThis as { __escuchainternaDbAdapter?: unknown }).__escuchainternaDbAdapter;

  ({ getDb } = await import('@/shared/infrastructure/persistence/SqliteConnection'));
  ({ SqliteMarketingAutomationRepository } = await import(
    '@/contexts/marketing/infrastructure/persistence/SqliteMarketingAutomationRepository'
  ));

  const db = getDb();
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO users (id, email, password_hash, created_at, role, status)
     VALUES (?, ?, 'hash', ?, 'psychologist', 'activo')`,
  );
  insert.run(OWNER_A, `${OWNER_A}@example.test`, now);
  insert.run(OWNER_B, `${OWNER_B}@example.test`, now);
});

beforeEach(() => {
  getDb()
    .prepare('DELETE FROM marketing_automations WHERE owner_user_id IN (?, ?)')
    .run(OWNER_A, OWNER_B);
});

afterAll(() => {
  try {
    getDb().close();
  } catch {
    // ya cerrada
  }
  delete (globalThis as { __escuchainternaDb?: unknown }).__escuchainternaDb;
  delete (globalThis as { __escuchainternaDbAdapter?: unknown }).__escuchainternaDbAdapter;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('automatizaciones de marketing por owner_user_id', () => {
  it('entrega defaults desactivados sin crear una configuración global', async () => {
    const repoA = new SqliteMarketingAutomationRepository(OWNER_A);
    const repoB = new SqliteMarketingAutomationRepository(OWNER_B);

    const defaultsA = (await repoA.listAll()).map((automation) => automation.toPrimitives());
    const defaultsB = (await repoB.listAll()).map((automation) => automation.toPrimitives());

    expect(defaultsA.map(({ kind, enabled }) => ({ kind, enabled }))).toEqual([
      { kind: 'cumpleanios', enabled: false },
      { kind: 'reactivacion', enabled: false },
    ]);
    expect(defaultsB.map(({ kind, enabled }) => ({ kind, enabled }))).toEqual([
      { kind: 'cumpleanios', enabled: false },
      { kind: 'reactivacion', enabled: false },
    ]);
    expect(
      getDb().prepare('SELECT COUNT(*) AS n FROM marketing_automations').get(),
    ).toEqual({ n: 0 });
  });

  it('guardar para A no modifica ni habilita la automatización de B', async () => {
    const repoA = new SqliteMarketingAutomationRepository(OWNER_A);
    const repoB = new SqliteMarketingAutomationRepository(OWNER_B);
    await new UpdateAutomation(repoA).update(
      new UpdateAutomationMessage({
        kind: 'cumpleanios',
        enabled: true,
        subject: 'Cumpleaños privado de A',
        body: 'Hola {{nombre}}, este mensaje pertenece a A.',
      }),
    );

    expect((await repoA.findByKind('cumpleanios')).toPrimitives()).toMatchObject({
      enabled: true,
      subject: 'Cumpleaños privado de A',
    });
    expect((await repoB.findByKind('cumpleanios')).toPrimitives()).toMatchObject({
      enabled: false,
      subject: '¡Feliz cumpleaños, {{nombre}}! 🎂',
    });
    const rows = getDb()
      .prepare('SELECT owner_user_id, kind FROM marketing_automations ORDER BY owner_user_id, kind')
      .all();
    expect(rows).toEqual([{ owner_user_id: OWNER_A, kind: 'cumpleanios' }]);
  });

  it('el job de A envía con su configuración y el de B permanece desactivado', async () => {
    const repoA = new SqliteMarketingAutomationRepository(OWNER_A);
    const repoB = new SqliteMarketingAutomationRepository(OWNER_B);
    await new UpdateAutomation(repoA).update(
      new UpdateAutomationMessage({
        kind: 'cumpleanios',
        enabled: true,
        subject: 'Solo A: {{nombre}}',
        body: 'Mensaje de A para {{nombre}}.',
      }),
    );
    const dispatcherA = new RecordingDispatcher();
    const dispatcherB = new RecordingDispatcher();
    const dependencies = [new BirthdayRecipientDirectory(), new EmptyDeliveryLog()] as const;

    const resultA = await new RunDueAutomations(repoA, ...dependencies, dispatcherA).run({
      senderName: 'Profesional A',
      scheduleLink: 'https://example.test/a',
      now: new Date('2026-07-22T12:00:00.000Z'),
    });
    const resultB = await new RunDueAutomations(repoB, ...dependencies, dispatcherB).run({
      senderName: 'Profesional B',
      scheduleLink: 'https://example.test/b',
      now: new Date('2026-07-22T12:00:00.000Z'),
    });

    expect(resultA.birthdayGreetings).toBe(1);
    expect(dispatcherA.emails[0]?.subject).toBe('Solo A: Paciente Cumpleaños');
    expect(resultB.birthdayGreetings).toBe(0);
    expect(dispatcherB.emails).toHaveLength(0);
  });
});
