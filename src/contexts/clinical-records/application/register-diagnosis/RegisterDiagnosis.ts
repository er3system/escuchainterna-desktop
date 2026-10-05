import { randomUUID } from 'node:crypto';
import { Diagnosis } from '../../domain/Diagnosis';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';
import type { Cie11Catalog } from '../../domain/repositories/Cie11Catalog';
import type { RegisterDiagnosisMessage } from './RegisterDiagnosisMessage';

export class RegisterDiagnosis {
  public constructor(
    private readonly diagnoses: DiagnosisRepository,
    private readonly catalog: Cie11Catalog,
  ) {}

  public async execute(message: RegisterDiagnosisMessage): Promise<string> {
    const entry = await this.catalog.findByCode(message.cie11Code());
    if (!entry) throw new Error(`El código CIE-11 "${message.cie11Code()}" no existe en el catálogo local.`);
    const diagnosis = Diagnosis.register({
      id: randomUUID(),
      patientId: message.patientId(),
      cie11Code: entry.code,
      cie11Title: entry.title,
      notes: message.notes(),
      registeredByUserId: message.registeredByUserId(),
    });
    await this.diagnoses.save(diagnosis);
    return diagnosis.diagnosisId();
  }
}
