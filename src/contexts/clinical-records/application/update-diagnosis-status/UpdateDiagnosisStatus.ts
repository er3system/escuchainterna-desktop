import { parseDiagnosisStatus } from '../../domain/Diagnosis';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';
import { DiagnosisNotFoundError } from '../../domain/errors/DiagnosisNotFoundError';

export class UpdateDiagnosisStatus {
  public constructor(private readonly diagnoses: DiagnosisRepository) {}

  public async execute(diagnosisId: string, patientId: string, status: string): Promise<void> {
    const diagnosis = await this.diagnoses.findById(diagnosisId);
    if (!diagnosis || !diagnosis.belongsTo(patientId)) {
      throw new DiagnosisNotFoundError(diagnosisId);
    }
    diagnosis.changeStatus(parseDiagnosisStatus(status));
    await this.diagnoses.save(diagnosis);
  }
}
