import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';

/**
 * Degrada la historia primaria del paciente a "registro aparte" (cambiar de formato,
 * §P3): conserva TODO el contenido pero la quita como primaria, para poder iniciar una
 * nueva historia con otro modelo SIN perder lo escrito. La degradada queda marcada
 * "(formato anterior)" y aparece en "Registros aparte". Acotado por dueño.
 */
export class DemotePrimaryHistory {
  public constructor(private readonly records: ClinicalRecordRepository) {}

  public async execute(recordId: string, patientId: string): Promise<void> {
    const record = await this.records.findById(recordId);
    if (!record || !record.belongsTo(patientId) || !record.isPrimaryHistory()) {
      throw new Error('Historia primaria no encontrada.');
    }
    const title = record.toPrimitives().title;
    record.demoteToRegistro();
    if (!/\(formato anterior\)\s*$/.test(title)) record.rename(`${title} (formato anterior)`);
    await this.records.save(record);
  }
}
