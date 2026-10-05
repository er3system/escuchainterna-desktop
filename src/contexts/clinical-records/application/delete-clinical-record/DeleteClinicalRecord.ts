import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { RecordSuggestionRepository } from '../../domain/repositories/RecordSuggestionRepository';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';

/**
 * Elimina una historia clínica (spec v2 §6.9). La UI exige confirmación
 * fuerte (escribir ELIMINAR); aquí solo se valida pertenencia y se borran
 * también los lotes de sugerencias de IA asociados a la historia.
 */
export class DeleteClinicalRecord {
  public constructor(
    private readonly records: ClinicalRecordRepository,
    private readonly suggestions: RecordSuggestionRepository,
  ) {}

  public async execute(recordId: string, patientId: string): Promise<void> {
    const record = await this.records.findById(recordId);
    if (!record || !record.belongsTo(patientId)) {
      throw new ClinicalRecordNotFoundError(recordId);
    }
    await this.suggestions.deleteByRecord(recordId);
    await this.records.delete(recordId);
  }
}
