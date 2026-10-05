import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import type { SaveClinicalRecordAnswersMessage } from './SaveClinicalRecordAnswersMessage';

export class SaveClinicalRecordAnswers {
  public constructor(private readonly records: ClinicalRecordRepository) {}

  public async execute(message: SaveClinicalRecordAnswersMessage): Promise<void> {
    const record = await this.records.findById(message.recordId());
    if (!record || !record.belongsTo(message.patientId())) {
      throw new ClinicalRecordNotFoundError(message.recordId());
    }
    record.answerMany(message.answers());
    await this.records.save(record);
  }
}
