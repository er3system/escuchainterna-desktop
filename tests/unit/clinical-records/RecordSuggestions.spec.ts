import { describe, expect, it } from 'vitest';
import { RecordSuggestionBatch } from '@/contexts/clinical-records/domain/RecordSuggestionBatch';
import { ApplyRecordSuggestions } from '@/contexts/clinical-records/application/apply-record-suggestions/ApplyRecordSuggestions';
import { ApplyRecordSuggestionsMessage } from '@/contexts/clinical-records/application/apply-record-suggestions/ApplyRecordSuggestionsMessage';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';
import type { RecordSuggestionRepository } from '@/contexts/clinical-records/domain/repositories/RecordSuggestionRepository';
import type { SessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/SessionNoteRepository';
import type { ClinicalTemplateRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalTemplateRepository';
import type { RecordSnapshot, SessionInsights } from '@/contexts/clinical-records/domain/SessionInsights';
import { SuggestRecordUpdates } from '@/contexts/clinical-records/application/suggest-record-updates/SuggestRecordUpdates';
import { EnsurePrimaryHistory } from '@/contexts/clinical-records/application/historia-clinica/EnsurePrimaryHistory';
import { historiaNucleoSections } from '@/contexts/clinical-records/domain/historiaBlocks';

function batchWith(items: Array<{ fieldId: string; suggestedValue: string }>): RecordSuggestionBatch {
  return RecordSuggestionBatch.create({
    id: 'lote-1',
    recordId: 'rec-1',
    sourceNoteId: 'nota-1',
    items: items.map((item) => ({
      fieldId: item.fieldId,
      sectionId: 'sec-1',
      label: item.fieldId,
      currentValue: '',
      suggestedValue: item.suggestedValue,
      reason: 'prueba',
    })),
  });
}

class InMemoryRecords implements ClinicalRecordRepository {
  public saved = 0;
  public constructor(public record: ClinicalRecord | null) {}
  public async save(record: ClinicalRecord): Promise<void> {
    this.record = record;
    this.saved += 1;
  }
  public async findById(id: string): Promise<ClinicalRecord | null> {
    return this.record && this.record.recordId() === id ? this.record : null;
  }
  public async listByPatient(): Promise<ClinicalRecord[]> {
    return this.record ? [this.record] : [];
  }
  public async findPrimaryHistory(): Promise<ClinicalRecord | null> {
    return this.record && this.record.isPrimaryHistory() ? this.record : null;
  }
  public async delete(): Promise<void> {
    this.record = null;
  }
}

class InMemorySuggestions implements RecordSuggestionRepository {
  public constructor(public batch: RecordSuggestionBatch | null) {}
  public async save(batch: RecordSuggestionBatch): Promise<void> {
    this.batch = batch;
  }
  public async findById(id: string): Promise<RecordSuggestionBatch | null> {
    return this.batch && this.batch.batchId() === id ? this.batch : null;
  }
  public async findOpenForRecord(): Promise<RecordSuggestionBatch | null> {
    return this.batch && this.batch.isPending() ? this.batch : null;
  }
  public async deleteByRecord(): Promise<void> {
    this.batch = null;
  }
}

describe('RecordSuggestionBatch', () => {
  it('nace pendiente con todos los campos pendientes', () => {
    const batch = batchWith([{ fieldId: 'a', suggestedValue: 'x' }]);
    const primitives = batch.toPrimitives();
    expect(primitives.status).toBe('pendiente');
    expect(primitives.items[0].status).toBe('pendiente');
  });

  it('decide marca por campo y lo no decidido queda rechazado', () => {
    const batch = batchWith([
      { fieldId: 'a', suggestedValue: 'x' },
      { fieldId: 'b', suggestedValue: 'y' },
      { fieldId: 'c', suggestedValue: 'z' },
    ]);
    batch.decide({ a: 'aprobada', b: 'rechazada' });
    expect(batch.approvedItems().map((item) => item.fieldId)).toEqual(['a']);
    const statuses = batch.toPrimitives().items.map((item) => item.status);
    expect(statuses).toEqual(['aprobada', 'rechazada', 'rechazada']);
  });
});

describe('SuggestRecordUpdates · snapshot de la historia consolidada', () => {
  it('arma el snapshot desde record.sections (núcleo), no desde BLANK', async () => {
    const records = new InMemoryRecords(null);
    const recordId = await new EnsurePrimaryHistory(records).ensure('pac-1');
    const nucleoFieldId = historiaNucleoSections()[0].fields[0].id;

    let captured: RecordSnapshot | null = null;
    const insights = {
      async suggestRecordUpdates(_content: string, snapshot: RecordSnapshot) {
        captured = snapshot;
        return [{ fieldId: nucleoFieldId, suggestedValue: 'propuesta', reason: 'r' }];
      },
    } as unknown as SessionInsights;
    const notes = {
      findById: () =>
        Promise.resolve({ belongsTo: () => true, currentContent: () => 'lo trabajado en sesión' }),
    } as unknown as SessionNoteRepository;
    const templates = { findById: () => Promise.resolve(null) } as unknown as ClinicalTemplateRepository;
    const suggestions = new InMemorySuggestions(null);

    const batch = await new SuggestRecordUpdates(notes, records, templates, suggestions, insights).execute({
      noteId: 'n-1',
      patientId: 'pac-1',
      recordId,
    });

    // El snapshot expone campos REALES del núcleo (no los 3 genéricos de BLANK).
    expect(captured!.fields.some((field) => field.fieldId === nucleoFieldId)).toBe(true);
    expect(captured!.fields.length).toBeGreaterThan(3);
    // Una propuesta sobre un campo real del núcleo sobrevive el filtro de validez.
    expect(batch.items.map((item) => item.fieldId)).toContain(nucleoFieldId);
  });
});

describe('ApplyRecordSuggestions', () => {
  it('solo los campos aprobados tocan la historia y el lote queda resuelto', async () => {
    const record = ClinicalRecord.start({
      id: 'rec-1',
      patientId: 'pac-1',
      templateId: null,
      title: 'Historia',
    });
    record.answerField('a', 'valor previo');
    const records = new InMemoryRecords(record);
    const suggestions = new InMemorySuggestions(
      batchWith([
        { fieldId: 'a', suggestedValue: 'valor sugerido A' },
        { fieldId: 'b', suggestedValue: 'valor sugerido B' },
      ]),
    );

    const result = await new ApplyRecordSuggestions(suggestions, records).execute(
      new ApplyRecordSuggestionsMessage({
        batchId: 'lote-1',
        patientId: 'pac-1',
        decisions: { a: 'aprobada', b: 'rechazada' },
      }),
    );

    expect(result.appliedCount).toBe(1);
    expect(result.rejectedCount).toBe(1);
    const answers = records.record!.toPrimitives().answers;
    expect(answers['a']).toBe('valor sugerido A');
    expect(answers['b']).toBeUndefined();
    expect(suggestions.batch!.isPending()).toBe(false);
  });

  it('sin aprobaciones la historia no se toca', async () => {
    const record = ClinicalRecord.start({
      id: 'rec-1',
      patientId: 'pac-1',
      templateId: null,
      title: 'Historia',
    });
    const records = new InMemoryRecords(record);
    const suggestions = new InMemorySuggestions(batchWith([{ fieldId: 'a', suggestedValue: 'x' }]));

    const result = await new ApplyRecordSuggestions(suggestions, records).execute(
      new ApplyRecordSuggestionsMessage({ batchId: 'lote-1', patientId: 'pac-1', decisions: {} }),
    );

    expect(result.appliedCount).toBe(0);
    expect(records.saved).toBe(0);
    expect(records.record!.toPrimitives().answers).toEqual({});
    expect(suggestions.batch!.isPending()).toBe(false);
  });

  it('rechaza lotes de otra historia/paciente', async () => {
    const record = ClinicalRecord.start({
      id: 'rec-1',
      patientId: 'pac-1',
      templateId: null,
      title: 'Historia',
    });
    const records = new InMemoryRecords(record);
    const suggestions = new InMemorySuggestions(batchWith([{ fieldId: 'a', suggestedValue: 'x' }]));

    await expect(
      new ApplyRecordSuggestions(suggestions, records).execute(
        new ApplyRecordSuggestionsMessage({
          batchId: 'lote-1',
          patientId: 'pac-OTRO',
          decisions: { a: 'aprobada' },
        }),
      ),
    ).rejects.toThrow();
    expect(records.record!.toPrimitives().answers).toEqual({});
  });
});
