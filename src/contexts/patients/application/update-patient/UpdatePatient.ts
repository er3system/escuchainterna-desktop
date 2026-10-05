import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { PatientNotFoundError } from '../../domain/errors/PatientNotFoundError';
import { UpdatePatientMessage } from './UpdatePatientMessage';

export class UpdatePatient {
  public constructor(private readonly patients: PatientRepository) {}

  public async update(message: UpdatePatientMessage): Promise<void> {
    const patient = await this.patients.findById(message.patientId());
    if (!patient) throw new PatientNotFoundError(message.patientId());

    patient.updateContact(
      message.patientName(),
      message.patientEmail(),
      message.patientPhone(),
      message.patientEmergencyContact(),
      message.patientDocument(),
    );
    patient.updateProfile(message.patientProfile());
    patient.retag(message.patientTags());

    await this.patients.save(patient);
  }
}
