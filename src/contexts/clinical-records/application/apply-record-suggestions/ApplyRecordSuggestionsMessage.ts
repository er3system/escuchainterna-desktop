import type { RecordSuggestionDecision } from '../../domain/RecordSuggestionBatch';

/** Decisiones humanas por campo: {fieldId: 'aprobada' | 'rechazada'}. */
export class ApplyRecordSuggestionsMessage {
  private readonly batchIdValue: string;
  private readonly patientIdValue: string;
  private readonly decisionsValue: Record<string, RecordSuggestionDecision>;

  public constructor(input: { batchId: string; patientId: string; decisions: unknown }) {
    if (!input.batchId || !input.patientId) {
      throw new Error('Faltan datos para aplicar las sugerencias.');
    }
    this.batchIdValue = input.batchId;
    this.patientIdValue = input.patientId;
    this.decisionsValue = this.coerceDecisions(input.decisions);
  }

  private coerceDecisions(raw: unknown): Record<string, RecordSuggestionDecision> {
    const decisions: Record<string, RecordSuggestionDecision> = {};
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return decisions;
    for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value === 'aprobada' || value === 'rechazada') decisions[fieldId] = value;
    }
    return decisions;
  }

  public batchId(): string {
    return this.batchIdValue;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public decisions(): Record<string, RecordSuggestionDecision> {
    return this.decisionsValue;
  }
}
