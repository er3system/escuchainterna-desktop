import { PatientPrimitives } from '../../domain/Patient';
import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { PatientNotFoundError } from '../../domain/errors/PatientNotFoundError';

export class GetPatient {
  public constructor(private readonly patients: PatientRepository) {}

  public async find(patientId: string): Promise<PatientPrimitives> {
    const patient = await this.patients.findById(patientId);
    if (!patient) throw new PatientNotFoundError(patientId);
    return patient.toPrimitives();
  }
}
