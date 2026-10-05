import { randomUUID } from 'node:crypto';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalRecordPrimitives } from '../../domain/ClinicalRecord';
import type { RecordSnapshot, RecordSnapshotField, SessionInsights } from '../../domain/SessionInsights';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { RecordSuggestionRepository } from '../../domain/repositories/RecordSuggestionRepository';
import { RecordSuggestionBatch, type RecordSuggestionBatchPrimitives } from '../../domain/RecordSuggestionBatch';
import { BLANK_RECORD_SECTIONS } from '../../domain/blankRecordSections';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import { SessionNoteNotFoundError } from '../../domain/errors/SessionNoteNotFoundError';

/**
 * Pide a la IA propuestas de cambio campo a campo sobre una historia clínica
 * a partir de una nota de sesión (spec v2 §6.7) y las persiste como lote
 * PENDIENTE. La historia NO se toca aquí: solo en ApplyRecordSuggestions y
 * únicamente con los campos aprobados por el profesional.
 */
export class SuggestRecordUpdates {
  public constructor(
    private readonly notes: SessionNoteRepository,
    private readonly records: ClinicalRecordRepository,
    private readonly templates: ClinicalTemplateRepository,
    private readonly suggestions: RecordSuggestionRepository,
    private readonly insights: SessionInsights,
  ) {}

  public async execute(input: {
    noteId: string;
    patientId: string;
    recordId: string;
  }): Promise<RecordSuggestionBatchPrimitives> {
    const note = await this.notes.findById(input.noteId);
    if (!note || !note.belongsTo(input.patientId)) throw new SessionNoteNotFoundError(input.noteId);

    const record = await this.records.findById(input.recordId);
    if (!record || !record.belongsTo(input.patientId)) {
      throw new ClinicalRecordNotFoundError(input.recordId);
    }

    const snapshot = await this.buildSnapshot(record.toPrimitives());
    const proposals = await this.insights.suggestRecordUpdates(note.currentContent(), snapshot);

    // Solo se aceptan propuestas sobre campos reales del snapshot.
    const validFieldIds = new Map(snapshot.fields.map((field) => [field.fieldId, field]));
    const items = proposals
      .filter((proposal) => validFieldIds.has(proposal.fieldId))
      .map((proposal) => {
        const field = validFieldIds.get(proposal.fieldId)!;
        return {
          fieldId: proposal.fieldId,
          sectionId: field.sectionId,
          label: field.label,
          currentValue: field.currentValue,
          suggestedValue: proposal.suggestedValue,
          reason: proposal.reason,
        };
      });

    // Un lote pendiente por historia: el nuevo reemplaza al anterior.
    const previous = await this.suggestions.findOpenForRecord(input.recordId);
    if (previous) {
      previous.resolve();
      await this.suggestions.save(previous);
    }

    const batch = RecordSuggestionBatch.create({
      id: randomUUID(),
      recordId: input.recordId,
      sourceNoteId: input.noteId,
      items,
    });
    await this.suggestions.save(batch);
    return batch.toPrimitives();
  }

  private async buildSnapshot(record: ClinicalRecordPrimitives): Promise<RecordSnapshot> {
    let sections: ClinicalSection[] = BLANK_RECORD_SECTIONS;
    let templateName = 'En blanco';
    if (record.sections && record.sections.length > 0) {
      // Historia clínica consolidada (núcleo + bloques): el snapshot que la IA
      // puede proponer sale de SUS propias secciones, no de una plantilla.
      sections = record.sections;
      templateName = 'Historia clínica';
    } else if (record.templateId) {
      const template = await this.templates.findById(record.templateId);
      if (template) {
        const primitives = template.toPrimitives();
        sections = primitives.sections;
        templateName = primitives.name;
      } else {
        sections = [];
        templateName = 'Plantilla eliminada';
      }
    }

    const fields: RecordSnapshotField[] = sections.flatMap((section) =>
      section.fields.map((field) => {
        const raw = record.answers[field.id];
        return {
          fieldId: field.id,
          sectionId: section.id,
          sectionTitle: section.title,
          label: field.label,
          type: field.type,
          currentValue: Array.isArray(raw) ? raw.join(', ') : (raw ?? ''),
        };
      }),
    );

    return { recordId: record.id, title: record.title, templateName, fields };
  }
}
