import type { PatientContextRetriever } from '../../domain/PatientContextRetriever';
import type { PatientOptionDto } from '../AssistantReadModels';

/** Pacientes activos del dueño en sesión para el selector "Hablar sobre". */
export class ListPatientOptions {
  public constructor(private readonly retriever: PatientContextRetriever) {}

  public async list(): Promise<PatientOptionDto[]> {
    return (await this.retriever.listPatients()).map((patient) => ({ id: patient.id, fullName: patient.fullName }));
  }
}
