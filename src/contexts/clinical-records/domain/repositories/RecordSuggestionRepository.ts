import type { RecordSuggestionBatch } from '../RecordSuggestionBatch';

export interface RecordSuggestionRepository {
  save(batch: RecordSuggestionBatch): Promise<void>;
  findById(id: string): Promise<RecordSuggestionBatch | null>;
  /** Último lote pendiente de revisión para una historia (si existe). */
  findOpenForRecord(recordId: string): Promise<RecordSuggestionBatch | null>;
  /** Elimina todos los lotes de una historia (al borrar la historia). */
  deleteByRecord(recordId: string): Promise<void>;
}
