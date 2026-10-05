import { describe, it, expect } from 'vitest';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import { OpenNewExpediente } from '@/contexts/clinical-records/application/open-new-expediente/OpenNewExpediente';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';

/** Doble en memoria con la MISMA semántica que el repo real: la primaria
 *  vigente es la historia NO sellada. */
class InMemoryRecords implements ClinicalRecordRepository {
  public readonly records: ClinicalRecord[] = [];
  public async save(record: ClinicalRecord): Promise<void> {
    const i = this.records.findIndex((r) => r.recordId() === record.recordId());
    if (i >= 0) this.records[i] = record;
    else this.records.push(record);
  }
  public async findById(id: string): Promise<ClinicalRecord | null> {
    return this.records.find((r) => r.recordId() === id) ?? null;
  }
  public async listByPatient(patientId: string): Promise<ClinicalRecord[]> {
    return this.records.filter((r) => r.belongsTo(patientId));
  }
  public async findPrimaryHistory(patientId: string): Promise<ClinicalRecord | null> {
    return this.records.find((r) => r.belongsTo(patientId) && r.isPrimaryHistory() && !r.isSealed()) ?? null;
  }
  public async delete(id: string): Promise<void> {
    const i = this.records.findIndex((r) => r.recordId() === id);
    if (i >= 0) this.records.splice(i, 1);
  }
}

function primary(id: string, title = 'Historia clínica · TREC'): ClinicalRecord {
  const record = ClinicalRecord.start({
    id,
    patientId: 'pac-1',
    templateId: null,
    title,
    kind: 'historia',
  });
  record.answerField('motivo', 'ansiedad');
  return record;
}

describe('ClinicalRecord.seal', () => {
  it('sella una vez (idempotente) y expone la fecha de sellado', () => {
    const record = primary('h1');
    expect(record.isSealed()).toBe(false);
    expect(record.sealedAt()).toBeNull();

    record.seal();
    const first = record.sealedAt();
    expect(record.isSealed()).toBe(true);
    expect(first).not.toBeNull();

    record.seal(); // no repisa la primera fecha
    expect(record.sealedAt()).toBe(first);
  });

  it('toPrimitives/fromPrimitives conservan closedAt', () => {
    const record = primary('h1');
    record.seal();
    const round = ClinicalRecord.fromPrimitives(record.toPrimitives());
    expect(round.isSealed()).toBe(true);
    expect(round.sealedAt()).toBe(record.sealedAt());
  });

  it('un expediente sellado es INMUTABLE: todo mutador lanza (cierra el write-path del servidor)', () => {
    const record = primary('h1');
    record.seal();
    expect(() => record.answerField('motivo', 'otro')).toThrow();
    expect(() => record.answerMany({ x: 'y' })).toThrow();
    expect(() => record.rename('Nuevo título')).toThrow();
    expect(() => record.demoteToRegistro()).toThrow();
    expect(() => record.addSection({ id: 's', title: 'S', fields: [] })).toThrow();
    expect(() => record.removeSection('s')).toThrow();
    // El contenido original se conserva intacto.
    expect(record.toPrimitives().answers['motivo']).toBe('ansiedad');
  });
});

describe('OpenNewExpediente (abrir expediente nuevo: episodio / relevo)', () => {
  it("sealScope 'current' sella la primaria vigente con el rótulo y la conserva", async () => {
    const repo = new InMemoryRecords();
    await repo.save(primary('h1'));

    const sealedIds = await new OpenNewExpediente(repo).execute('pac-1', {
      sealScope: 'current',
      label: 'Expediente del tratante anterior',
    });

    expect(sealedIds).toEqual(['h1']);
    const after = (await repo.findById('h1'))!.toPrimitives();
    expect(after.kind).toBe('historia'); // sigue siendo historia, pero sellada
    expect(after.closedAt).not.toBeNull();
    expect(after.title).toBe('Expediente del tratante anterior');
    expect(after.answers['motivo']).toBe('ansiedad'); // contenido preservado
    // Ya no hay primaria abierta → el flujo puede crear una nueva.
    expect(await repo.findPrimaryHistory('pac-1')).toBeNull();
  });

  it("sealScope 'none' (episodio que coexiste) NO sella nada", async () => {
    const repo = new InMemoryRecords();
    await repo.save(primary('h1'));
    const sealedIds = await new OpenNewExpediente(repo).execute('pac-1', { sealScope: 'none' });
    expect(sealedIds).toEqual([]);
    expect((await repo.findById('h1'))!.toPrimitives().closedAt).toBeNull();
    // La vigente sigue abierta (coexistirá con la que cree el selector).
    expect(await repo.findPrimaryHistory('pac-1')).not.toBeNull();
  });

  it("sealScope 'all' (relevo) sella TODOS los expedientes abiertos", async () => {
    const repo = new InMemoryRecords();
    await repo.save(primary('h1', 'Episodio 1'));
    await repo.save(primary('h2', 'Episodio 2'));

    const sealedIds = await new OpenNewExpediente(repo).execute('pac-1', {
      sealScope: 'all',
      label: 'Expediente del tratante anterior',
    });

    expect(sealedIds.sort()).toEqual(['h1', 'h2']);
    expect((await repo.findById('h1'))!.toPrimitives().closedAt).not.toBeNull();
    expect((await repo.findById('h2'))!.toPrimitives().closedAt).not.toBeNull();
    // Tras un relevo no queda ninguna primaria abierta.
    expect(await repo.findPrimaryHistory('pac-1')).toBeNull();
  });

  it('sin primaria abierta no sella nada (lista vacía)', async () => {
    const repo = new InMemoryRecords();
    expect(await new OpenNewExpediente(repo).execute('pac-1', { sealScope: 'current' })).toEqual([]);
    expect(await new OpenNewExpediente(repo).execute('pac-1', { sealScope: 'all' })).toEqual([]);
  });

  it('sin rótulo conserva el título original al sellar', async () => {
    const repo = new InMemoryRecords();
    await repo.save(primary('h1'));
    await new OpenNewExpediente(repo).execute('pac-1', { sealScope: 'current' });
    expect((await repo.findById('h1'))!.toPrimitives().title).toBe('Historia clínica · TREC');
  });
});
