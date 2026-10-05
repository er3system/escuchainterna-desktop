import { DomainEvent } from '@/shared/domain/DomainEvent';

export class PatientWasRestored extends DomainEvent {
  public constructor(patientId: string) {
    super('patients.patient_was_restored', patientId);
  }
}
