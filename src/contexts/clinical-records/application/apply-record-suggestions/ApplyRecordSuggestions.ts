import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { RecordSuggestionRepository } from '../../domain/repositories/RecordSuggestionRepository';
import { RecordSuggestionNotFoundError } from '../../domain/errors/RecordSuggestionNotFoundError';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import type { ApplyRecordSuggestionsMessage } from './ApplyRecordSuggestionsMessage';

export interface AppliedSuggestionsResult {
  appliedCount: number;
  rejectedCount: number;
}

/**
 * Cierra un lote de sugerencias de IA con las decisiones del profesional:
 * SOLO los campos aprobados tocan la historia clínica (spec v2 §6.7).
 */
export class ApplyRecordSuggestions {
  public constructor(
    private readonly suggestions: RecordSuggestionRepository,
    private readonly records: ClinicalRecordRepository,
  ) {}

  public async execute(message: ApplyRecordSuggestionsMessage): Promise<AppliedSuggestionsResult> {
    const batch = await this.suggestions.findById(message.batchId());
    if (!batch || !batch.isPending()) throw new RecordSuggestionNotFoundError(message.batchId());

    const record = await this.records.findById(batch.targetRecordId());
    if (!record || !record.belongsTo(message.patientId())) {
      throw new ClinicalRecordNotFoundError(batch.targetRecordId());
    }

    batch.decide(message.decisions());
    const approved = batch.approvedItems();
    for (const item of approved) {
      record.answerField(item.fieldId, item.suggestedValue);
    }
    if (approved.length > 0) await this.records.save(record);

    batch.resolve();
    await this.suggestions.save(batch);

    return {
      appliedCount: approved.length,
      rejectedCount: batch.toPrimitives().items.length - approved.length,
    };
  }
}
