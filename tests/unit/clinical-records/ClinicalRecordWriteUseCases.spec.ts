import { describe, it, expect } from 'vitest';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import { SaveClinicalRecordAnswers } from '@/contexts/clinical-records/application/save-clinical-record-answers/SaveClinicalRecordAnswers';
import { SaveClinicalRecordAnswersMessage } from '@/contexts/clinical-records/application/save-clinical-record-answers/SaveClinicalRecordAnswersMessage';
import { DeleteClinicalRecord } from '@/contexts/clinical-records/application/delete-clinical-record/DeleteClinicalRecord';
import { ClinicalRecordNotFoundError } from '@/contexts/clinical-records/domain/errors/ClinicalRecordNotFoundError';
import { SealedRecordIsImmutableError } from '@/contexts/clinical-records/domain/errors/SealedRecordIsImmutableError';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';
import type { RecordSuggestionRepository } from '@/contexts/clinical-records/domain/repositories/RecordSuggestionRepository';
import type { RecordSuggestionBatch } from '@/contexts/clinical-records/domain/RecordSuggestionBatch';

/** Doble en memoria del repo de historias (mismo patrón que los specs hermanos). */
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

/** Espía del repo de sugerencias: registra a qué historias se les llamó deleteByRecord. */
class SpySuggestions implements RecordSuggestionRepository {
  public readonly deleted: string[] = [];
  public async save(_batch: RecordSuggestionBatch): Promise<void> {}
  public async findById(_id: string): Promise<RecordSuggestionBatch | null> {
    return null;
  }
  public async findOpenForRecord(_recordId: string): Promise<RecordSuggestionBatch | null> {
    return null;
  }
  public async deleteByRecord(recordId: string): Promise<void> {
    this.deleted.push(recordId);
  }
}

function history(id: string, patientId = 'pac-1'): ClinicalRecord {
  const record = ClinicalRecord.start({
    id,
    patientId,
    templateId: null,
    title: 'Historia clínica · TREC',
    kind: 'historia',
  });
  record.answerField('motivo', 'ansiedad');
  return record;
}

describe('SaveClinicalRecordAnswers (guardar respuestas §write-path)', () => {
  it('[scoping] rechaza un record de otro paciente → ClinicalRecordNotFoundError', async () => {
    const repo = new InMemoryRecords();
    await repo.save(history('h1', 'pac-1'));

    const message = new SaveClinicalRecordAnswersMessage({
      recordId: 'h1',
      patientId: 'otro-paciente',
      answers: { motivo: 'tristeza' },
    });

    await expect(new SaveClinicalRecordAnswers(repo).execute(message)).rejects.toThrow(ClinicalRecordNotFoundError);
    // El contenido original no se tocó.
    expect((await repo.findById('h1'))!.toPrimitives().answers['motivo']).toBe('ansiedad');
  });

  it('[inmutabilidad e2e] sobre un record SELLADO propaga SealedRecordIsImmutableError', async () => {
    const repo = new InMemoryRecords();
    const sealed = history('h1', 'pac-1');
    sealed.seal();
    await repo.save(sealed);

    const message = new SaveClinicalRecordAnswersMessage({
      recordId: 'h1',
      patientId: 'pac-1',
      answers: { motivo: 'otro' },
    });

    await expect(new SaveClinicalRecordAnswers(repo).execute(message)).rejects.toThrow(SealedRecordIsImmutableError);
    // El sellado preservó el contenido íntegro.
    expect((await repo.findById('h1'))!.toPrimitives().answers['motivo']).toBe('ansiedad');
  });
});

describe('DeleteClinicalRecord (borrar historia §6.9, cascada de sugerencias)', () => {
  it('[scoping] rechaza un record de otro paciente → ClinicalRecordNotFoundError (sin tocar sugerencias)', async () => {
    const repo = new InMemoryRecords();
    const suggestions = new SpySuggestions();
    await repo.save(history('h1', 'pac-1'));

    await expect(new DeleteClinicalRecord(repo, suggestions).execute('h1', 'otro-paciente')).rejects.toThrow(
      ClinicalRecordNotFoundError,
    );
    // No se borró nada ni se disparó la cascada.
    expect(await repo.findById('h1')).not.toBeNull();
    expect(suggestions.deleted).toEqual([]);
  });

  it('[integridad/cascada] si pertenece, borra el record Y llama suggestions.deleteByRecord(recordId)', async () => {
    const repo = new InMemoryRecords();
    const suggestions = new SpySuggestions();
    await repo.save(history('h1', 'pac-1'));

    await new DeleteClinicalRecord(repo, suggestions).execute('h1', 'pac-1');

    expect(await repo.findById('h1')).toBeNull();
    expect(suggestions.deleted).toEqual(['h1']);
  });
});
