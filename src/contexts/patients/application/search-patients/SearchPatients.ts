import { PatientPrimitives } from '../../domain/Patient';
import { PatientRepository } from '../../domain/repositories/PatientRepository';
import { SearchPatientsQuery } from './SearchPatientsQuery';

export interface PatientListItem extends PatientPrimitives {
  /** false ⇒ la UI marca el teléfono en rojo: no llegan mensajes de WhatsApp. */
  phoneReachableByWhatsApp: boolean;
}

export class SearchPatients {
  public constructor(private readonly patients: PatientRepository) {}

  public async search(query: SearchPatientsQuery): Promise<PatientListItem[]> {
    const patients = await this.patients.search(query.toCriteria());
    return patients.map((patient) => ({
      ...patient.toPrimitives(),
      phoneReachableByWhatsApp: patient.hasWhatsAppReachablePhone(),
    }));
  }
}
