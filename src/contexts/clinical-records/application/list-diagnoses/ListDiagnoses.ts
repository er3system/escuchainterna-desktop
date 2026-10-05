import type { DiagnosisPrimitives } from '../../domain/Diagnosis';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';

export class ListDiagnoses {
  public constructor(private readonly diagnoses: DiagnosisRepository) {}

  /** Diagnósticos del paciente, más recientes primero. */
  public async execute(patientId: string): Promise<DiagnosisPrimitives[]> {
    const diagnoses = await this.diagnoses.listByPatient(patientId);
    return diagnoses
      .map((diagnosis) => diagnosis.toPrimitives())
      .sort((a, b) => b.diagnosedAt.localeCompare(a.diagnosedAt));
  }
}
