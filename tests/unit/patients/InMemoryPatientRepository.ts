import { Patient } from '@/contexts/patients/domain/Patient';
import {
  PatientRepository,
  PatientSearchCriteria,
} from '@/contexts/patients/domain/repositories/PatientRepository';

export class InMemoryPatientRepository implements PatientRepository {
  private readonly patients = new Map<string, Patient>();

  public async save(patient: Patient): Promise<void> {
    this.patients.set(patient.patientId(), patient);
  }

  public async findById(id: string): Promise<Patient | null> {
    return this.patients.get(id) ?? null;
  }

  public async search(criteria: PatientSearchCriteria): Promise<Patient[]> {
    const text = criteria.text.toLowerCase();
    return [...this.patients.values()].filter((patient) => {
      const primitives = patient.toPrimitives();
      if (criteria.archived === 'activos' && primitives.archived) return false;
      if (criteria.archived === 'archivados' && !primitives.archived) return false;
      if (criteria.tag && !primitives.tags.includes(criteria.tag)) return false;
      if (criteria.gender && primitives.gender !== criteria.gender) return false;
      if (text.length === 0) return true;
      return (
        primitives.fullName.toLowerCase().includes(text) ||
        primitives.email.toLowerCase().includes(text) ||
        primitives.phone.toLowerCase().includes(text) ||
        (primitives.documentNumber ?? '').toLowerCase().includes(text)
      );
    });
  }

  public async distinctTags(): Promise<string[]> {
    const tags = new Set<string>();
    for (const patient of this.patients.values()) {
      for (const tag of patient.toPrimitives().tags) tags.add(tag);
    }
    return [...tags].sort((a, b) => a.localeCompare(b, 'es'));
  }
}
