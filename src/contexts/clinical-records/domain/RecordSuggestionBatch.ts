import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export type RecordSuggestionDecision = 'pendiente' | 'aprobada' | 'rechazada';

/** Propuesta de cambio sobre UN campo de la historia, con su decisión humana. */
export interface RecordSuggestionItem {
  fieldId: string;
  sectionId: string;
  label: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  status: RecordSuggestionDecision;
}

export interface RecordSuggestionBatchPrimitives {
  id: string;
  recordId: string;
  sourceNoteId: string | null;
  items: RecordSuggestionItem[];
  status: 'pendiente' | 'resuelta';
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * Lote de sugerencias de la IA sobre una historia clínica (spec v2 §6.7).
 * Regla central: NINGUNA sugerencia toca la historia hasta que el profesional
 * la aprueba explícitamente y aplica el lote.
 */
export class RecordSuggestionBatch extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly recordId: string,
    private readonly sourceNoteId: string | null,
    private items: RecordSuggestionItem[],
    private status: 'pendiente' | 'resuelta',
    private readonly createdAt: Date,
    private resolvedAt: Date | null,
  ) {
    super();
  }

  public static create(input: {
    id: string;
    recordId: string;
    sourceNoteId: string | null;
    items: Array<Omit<RecordSuggestionItem, 'status'>>;
  }): RecordSuggestionBatch {
    return new RecordSuggestionBatch(
      input.id,
      input.recordId,
      input.sourceNoteId,
      input.items.map((item) => ({ ...item, status: 'pendiente' as const })),
      'pendiente',
      new Date(),
      null,
    );
  }

  public static fromPrimitives(primitives: RecordSuggestionBatchPrimitives): RecordSuggestionBatch {
    return new RecordSuggestionBatch(
      primitives.id,
      primitives.recordId,
      primitives.sourceNoteId,
      primitives.items.map((item) => ({ ...item })),
      primitives.status,
      new Date(primitives.createdAt),
      primitives.resolvedAt ? new Date(primitives.resolvedAt) : null,
    );
  }

  /** Registra la decisión humana por campo; ignora campos desconocidos. */
  public decide(decisions: Record<string, RecordSuggestionDecision>): void {
    if (this.status === 'resuelta') return;
    this.items = this.items.map((item) => {
      const decision = decisions[item.fieldId];
      if (decision === 'aprobada' || decision === 'rechazada') {
        return { ...item, status: decision };
      }
      return { ...item, status: 'rechazada' };
    });
  }

  /** Solo los campos aprobados se aplican a la historia. */
  public approvedItems(): RecordSuggestionItem[] {
    return this.items.filter((item) => item.status === 'aprobada').map((item) => ({ ...item }));
  }

  public resolve(): void {
    if (this.status === 'resuelta') return;
    this.status = 'resuelta';
    this.resolvedAt = new Date();
  }

  public batchId(): string {
    return this.id;
  }

  public targetRecordId(): string {
    return this.recordId;
  }

  public isPending(): boolean {
    return this.status === 'pendiente';
  }

  public toPrimitives(): RecordSuggestionBatchPrimitives {
    return {
      id: this.id,
      recordId: this.recordId,
      sourceNoteId: this.sourceNoteId,
      items: this.items.map((item) => ({ ...item })),
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      resolvedAt: this.resolvedAt ? this.resolvedAt.toISOString() : null,
    };
  }
}
