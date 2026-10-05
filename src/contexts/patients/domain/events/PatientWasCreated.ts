import { DomainEvent } from '@/shared/domain/DomainEvent';

export class PatientWasCreated extends DomainEvent {
  public constructor(
    patientId: string,
    public readonly fullName: string,
  ) {
    super('patients.patient_was_created', patientId);
  }
}
