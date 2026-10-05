import { describe, it, expect } from 'vitest';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import { DemotePrimaryHistory } from '@/contexts/clinical-records/application/demote-primary-history/DemotePrimaryHistory';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';

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
    return this.records.find((r) => r.belongsTo(patientId) && r.isPrimaryHistory()) ?? null;
  }
  public async delete(id: string): Promise<void> {
    const i = this.records.findIndex((r) => r.recordId() === id);
    if (i >= 0) this.records.splice(i, 1);
  }
}

function primary(id: string): ClinicalRecord {
  const record = ClinicalRecord.start({
    id,
    patientId: 'pac-1',
    templateId: null,
    title: 'Historia clínica · TREC',
    kind: 'historia',
  });
  record.answerField('motivo', 'ansiedad');
  return record;
}

describe('DemotePrimaryHistory (cambiar de formato §P3)', () => {
  it('degrada la primaria a registro aparte conservando el contenido y marca el título', async () => {
    const repo = new InMemoryRecords();
    await repo.save(primary('h1'));
    expect(await repo.findPrimaryHistory('pac-1')).not.toBeNull();

    await new DemotePrimaryHistory(repo).execute('h1', 'pac-1');

    const after = (await repo.findById('h1'))!.toPrimitives();
    expect(after.kind).toBe('registro');
    expect(after.title).toBe('Historia clínica · TREC (formato anterior)');
    expect(after.answers['motivo']).toBe('ansiedad'); // contenido conservado
    // Ya no hay historia primaria → se puede iniciar una nueva.
    expect(await repo.findPrimaryHistory('pac-1')).toBeNull();
  });

  it('no degrada un registro que no es la primaria', async () => {
    const repo = new InMemoryRecords();
    const registro = ClinicalRecord.start({ id: 'r1', patientId: 'pac-1', templateId: null, title: 'Registro' });
    await repo.save(registro);
    await expect(new DemotePrimaryHistory(repo).execute('r1', 'pac-1')).rejects.toThrow();
  });

  it('exige pertenencia al paciente', async () => {
    const repo = new InMemoryRecords();
    await repo.save(primary('h2'));
    await expect(new DemotePrimaryHistory(repo).execute('h2', 'otro')).rejects.toThrow();
  });
});
