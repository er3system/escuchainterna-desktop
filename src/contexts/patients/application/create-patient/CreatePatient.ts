import { randomUUID } from 'node:crypto';
import { Patient } from '../../domain/Patient';
import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { CreatePatientMessage } from './CreatePatientMessage';

export class CreatePatient {
  public constructor(private readonly patients: PatientRepository) {}

  public async create(message: CreatePatientMessage): Promise<string> {
    const patient = Patient.create(
      randomUUID(),
      message.patientName(),
      message.patientEmail(),
      message.patientPhone(),
      message.patientProfile(),
      message.patientEmergencyContact(),
      message.patientTags(),
    );
    patient.setDocument(message.patientDocument());
    // Representante legal (acudiente): solo si vinieron datos en el alta (menores).
    if (message.hasGuardian()) {
      const guardian = message.patientGuardian();
      patient.setGuardian(guardian.name, guardian.relationship, guardian.document);
    }
    const organizationId = message.owningOrganizationId();
    if (organizationId) patient.placeInOrganization(organizationId);
    await this.patients.save(patient);
    return patient.patientId();
  }
}
