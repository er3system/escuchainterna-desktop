import { DomainEvent } from '@/shared/domain/DomainEvent';

export class PatientWasArchived extends DomainEvent {
  public constructor(patientId: string) {
    super('patients.patient_was_archived', patientId);
  }
}
