import { describe, it, expect } from 'vitest';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';
import { historiaBlockCatalog } from '@/contexts/clinical-records/domain/historiaBlocks';
import { ClinicalRecordNotFoundError } from '@/contexts/clinical-records/domain/errors/ClinicalRecordNotFoundError';
import { SealedRecordIsImmutableError } from '@/contexts/clinical-records/domain/errors/SealedRecordIsImmutableError';
import { EnsurePrimaryHistory } from '@/contexts/clinical-records/application/historia-clinica/EnsurePrimaryHistory';
import { AddHistoriaBlock } from '@/contexts/clinical-records/application/historia-clinica/AddHistoriaBlock';
import { RemoveHistoriaBlock } from '@/contexts/clinical-records/application/historia-clinica/RemoveHistoriaBlock';

/** Mismo doble InMemory que HistoriaConsolidada.spec.ts. */
class InMemoryClinicalRecordRepository implements ClinicalRecordRepository {
  public readonly records: ClinicalRecord[] = [];

  public async save(record: ClinicalRecord): Promise<void> {
    const index = this.records.findIndex((r) => r.recordId() === record.recordId());
    if (index >= 0) this.records[index] = record;
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
    const index = this.records.findIndex((r) => r.recordId() === id);
    if (index >= 0) this.records.splice(index, 1);
  }
}

function tecnicaBlockId(): string {
  return historiaBlockCatalog().find((b) => b.category === 'Técnica')!.id;
}

describe('Historia clínica — scoping de bloques y sellado', () => {
  describe('scoping por paciente', () => {
    it('AddHistoriaBlock RECHAZA un record cuyo patientId no coincide → ClinicalRecordNotFoundError', async () => {
      const repo = new InMemoryClinicalRecordRepository();
      const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
      const before = (await repo.findById(id))!.ownSections()!.length;

      await expect(new AddHistoriaBlock(repo).add(id, 'paciente-2', tecnicaBlockId())).rejects.toThrow(
        ClinicalRecordNotFoundError,
      );
      // No mutó el record del paciente-1.
      expect((await repo.findById(id))!.ownSections()!).toHaveLength(before);
    });

    it('RemoveHistoriaBlock RECHAZA un record cuyo patientId no coincide → ClinicalRecordNotFoundError', async () => {
      const repo = new InMemoryClinicalRecordRepository();
      const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
      const blockId = tecnicaBlockId();
      await new AddHistoriaBlock(repo).add(id, 'paciente-1', blockId);
      const before = (await repo.findById(id))!.ownSections()!.length;

      await expect(new RemoveHistoriaBlock(repo).remove(id, 'paciente-2', blockId)).rejects.toThrow(
        ClinicalRecordNotFoundError,
      );
      // El bloque sigue ahí: el guard de pertenencia frenó la mutación.
      expect((await repo.findById(id))!.ownSections()!).toHaveLength(before);
    });
  });

  describe('inmutabilidad del expediente sellado', () => {
    it('AddHistoriaBlock sobre un record SELLADO propaga SealedRecordIsImmutableError', async () => {
      const repo = new InMemoryClinicalRecordRepository();
      const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
      const sealed = (await repo.findById(id))!;
      sealed.seal();
      await repo.save(sealed);

      await expect(new AddHistoriaBlock(repo).add(id, 'paciente-1', tecnicaBlockId())).rejects.toThrow(
        SealedRecordIsImmutableError,
      );
    });

    it('RemoveHistoriaBlock sobre un record SELLADO propaga SealedRecordIsImmutableError', async () => {
      const repo = new InMemoryClinicalRecordRepository();
      const id = await new EnsurePrimaryHistory(repo).ensure('paciente-1');
      const blockId = tecnicaBlockId();
      // Añade un bloque ANTES de sellar para tener algo que intentar quitar.
      await new AddHistoriaBlock(repo).add(id, 'paciente-1', blockId);
      const sealed = (await repo.findById(id))!;
      sealed.seal();
      await repo.save(sealed);

      await expect(new RemoveHistoriaBlock(repo).remove(id, 'paciente-1', blockId)).rejects.toThrow(
        SealedRecordIsImmutableError,
      );
    });
  });
});
