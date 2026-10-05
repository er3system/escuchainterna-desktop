import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Email, UUID } from '@haskou/value-objects';
import { SqliteGoogleCalendarConnectionRepository } from '@/contexts/practitioner/infrastructure/persistence/SqliteGoogleCalendarConnectionRepository';
import { SqliteCalendarSchedule } from '@/contexts/practitioner/infrastructure/persistence/SqliteCalendarSchedule';
import { GoogleCalendarConnection } from '@/contexts/practitioner/domain/GoogleCalendarConnection';
import { GoogleCalendarGrant, GOOGLE_CALENDAR_SCOPES } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarGrant';
import { DesktopGoogleCalendarClient } from '@/contexts/practitioner/domain/value-objects/DesktopGoogleCalendarClient';
import { GoogleCalendarReference } from '@/contexts/practitioner/domain/value-objects/GoogleCalendarReference';
import { CalendarTimeWindow } from '@/contexts/practitioner/domain/value-objects/CalendarTimeWindow';
import { redactIntegrationSecrets } from '@/contexts/practitioner/domain/integrationCredentials';
import type { DatabaseAdapter, SqlParam } from '@/shared/infrastructure/persistence/DatabaseAdapter';
class CalendarMemoryDatabase implements DatabaseAdapter {
  public constructor(public readonly sqlite: DatabaseSync) {}
  public async query<Row>(sql: string, params: SqlParam[] = []): Promise<Row[]> { return this.sqlite.prepare(sql).all(...params) as Row[]; }
  public async queryRow<Row>(sql: string, params: SqlParam[] = []): Promise<Row | null> { return this.sqlite.prepare(sql).get(...params) as Row ?? null; }
  public async execute(sql: string, params: SqlParam[] = []): Promise<void> { this.sqlite.prepare(sql).run(...params); }
  public async transaction<T>(action: () => Promise<T> | T): Promise<T> { this.sqlite.exec('BEGIN'); try { const result = await action(); this.sqlite.exec('COMMIT'); return result; } catch (error) { this.sqlite.exec('ROLLBACK'); throw error; } }
  public afterCommit(action: () => void): void { action(); }
}
const owner = new UUID('11111111-1111-4111-8111-111111111111'); const other = new UUID('22222222-2222-4222-8222-222222222222');
let sqlite: DatabaseSync; let db: CalendarMemoryDatabase;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:'); db = new CalendarMemoryDatabase(sqlite);
  sqlite.exec("CREATE TABLE integration_connections (id TEXT PRIMARY KEY, provider TEXT, owner_user_id TEXT, status TEXT, config_json TEXT, connected_at TEXT, UNIQUE(provider, owner_user_id)); CREATE TABLE users (id TEXT, role TEXT, status TEXT); CREATE TABLE bookings (id TEXT, owner_user_id TEXT, start_at TEXT, end_at TEXT, status TEXT, patient_name TEXT);");
  process.env.DATA_ENCRYPTION_KEY = 'calendar-fixture-encryption-key-1234567890'; delete (globalThis as { __escuchainternaIntegrationKeys?: unknown }).__escuchainternaIntegrationKeys;
});
afterEach(() => { sqlite.close(); delete process.env.DATA_ENCRYPTION_KEY; delete (globalThis as { __escuchainternaIntegrationKeys?: unknown }).__escuchainternaIntegrationKeys; });
const connection = (): GoogleCalendarConnection => new GoogleCalendarConnection(DesktopGoogleCalendarClient.create('12345678-fixture.apps.googleusercontent.com', 'secret-fixture'), GoogleCalendarGrant.create('access-fixture', 'refresh-fixture', Date.now() + 3600_000, GOOGLE_CALENDAR_SCOPES.join(' ')), new Email('fixture@example.test'), GoogleCalendarReference.create('fixture-calendar'));
describe('credenciales y horarios de Calendar por dueño', () => {
  it('cifra todo el acceso, aísla propietarios y desconecta solo al dueño', async () => {
    const repository = new SqliteGoogleCalendarConnectionRepository(db); await repository.save(owner, connection()); await repository.save(other, connection());
    const raw = sqlite.prepare('SELECT config_json FROM integration_connections WHERE owner_user_id = ?').get(owner.toString()) as { config_json: string };
    expect(raw.config_json).toMatch(/^enc:cfg:v1:/); expect(raw.config_json).not.toMatch(/refresh-fixture|access-fixture|secret-fixture|fixture@example/);
    expect((await repository.find(owner))?.toPrimitives().refresh_token).toBe('refresh-fixture');
    await repository.disconnect(owner); expect(await repository.find(owner)).toBeNull(); expect(await repository.find(other)).not.toBeNull();
  });
  it('credenciales simuladas, cifrado alterado y datos de otra fila no cuentan como conexión', async () => {
    const repository = new SqliteGoogleCalendarConnectionRepository(db);
    sqlite.prepare('INSERT INTO integration_connections VALUES (?, ?, ?, ?, ?, ?)').run('fixture-row', 'google_calendar', owner.toString(), 'conectado', JSON.stringify({ client_id: 'fixture', client_secret: 'secret' }), null);
    expect(await repository.find(owner)).toBeNull(); await repository.save(owner, connection()); await repository.save(other, connection());
    sqlite.prepare('UPDATE integration_connections SET config_json = (SELECT config_json FROM integration_connections WHERE owner_user_id = ?) WHERE owner_user_id = ?').run(other.toString(), owner.toString());
    expect(await repository.find(owner)).toBeNull();
  });
  it('un usuario suspendido o asistente no puede terminar una conexión pendiente', async () => {
    const repository = new SqliteGoogleCalendarConnectionRepository(db); const insert = sqlite.prepare('INSERT INTO users VALUES (?, ?, ?)');
    insert.run(owner.toString(), 'psychologist', 'activo'); insert.run(other.toString(), 'assistant', 'activo');
    expect(await repository.ownerIsActive(owner)).toBe(true); expect(await repository.ownerIsActive(other)).toBe(false);
    sqlite.prepare('UPDATE users SET status = ? WHERE id = ?').run('suspendido', owner.toString()); expect(await repository.ownerIsActive(owner)).toBe(false);
  });
  it('lee únicamente horarios activos del dueño en el intervalo; nunca proyecta pacientes', async () => {
    const insert = sqlite.prepare('INSERT INTO bookings VALUES (?, ?, ?, ?, ?, ?)');
    insert.run(owner.toString(), owner.toString(), '2026-10-06T10:00:00.000Z', '2026-10-06T11:00:00.000Z', 'agendada', 'No debe salir a Google');
    insert.run(other.toString(), other.toString(), '2026-10-06T10:00:00.000Z', '2026-10-06T11:00:00.000Z', 'agendada', 'Paciente ajeno');
    insert.run('33333333-3333-4333-8333-333333333333', owner.toString(), '2026-10-06T12:00:00.000Z', '2026-10-06T13:00:00.000Z', 'cancelada', 'Cancelado');
    const slots = await new SqliteCalendarSchedule(db).slots(owner, CalendarTimeWindow.create('2026-10-01', '2026-10-31'));
    expect(slots).toHaveLength(1); expect(slots[0].booking.toString()).toBe(owner.toString()); expect(JSON.stringify(slots)).not.toMatch(/Paciente|debe salir/);
  });
  it('redacta también refresh_token y verificadores en cualquier pantalla antigua', () => {
    expect(redactIntegrationSecrets({ refresh_token: 'private', code_verifier: 'private', client_id: 'public' })).toEqual({ refresh_token: '••••••••', code_verifier: '••••••••', client_id: 'public' });
  });
});
