export interface PatientTagsRepository {
  /** Devuelve null si el paciente no existe. */
  findTags(patientId: string): Promise<string[] | null>;
  saveTags(patientId: string, tags: string[]): Promise<void>;
}
