import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { PatientNotFoundError } from '../../domain/errors/PatientNotFoundError';

export class ArchivePatient {
  public constructor(private readonly patients: PatientRepository) {}

  public async archive(patientId: string): Promise<void> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new PatientNotFoundError(patientId);
    patient.archive();
    await this.patients.save(patient);
  }

  public async restore(patientId: string): Promise<void> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new PatientNotFoundError(patientId);
    patient.restore();
    await this.patients.save(patient);
  }
}
