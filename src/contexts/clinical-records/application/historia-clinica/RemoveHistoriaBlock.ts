import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';

/**
 * Quita un bloque (sección añadida) de la historia clínica consolidada. Solo se
 * permiten quitar bloques del catálogo, identificables porque su id está
 * namespaced (`${templateId}:${sectionId}`, contiene ':'); las secciones del
 * núcleo (ids simples) están protegidas y no se pueden quitar. Sección
 * desconocida o del núcleo = no-op.
 */
export class RemoveHistoriaBlock {
  public constructor(private readonly records: ClinicalRecordRepository) {}

  public async remove(recordId: string, patientId: string, sectionId: string): Promise<void> {
    const record = await this.records.findById(recordId);
    // Pertenencia al paciente (no solo existencia), igual que AddSessionBlock.
    if (!record || !record.belongsTo(patientId)) throw new ClinicalRecordNotFoundError(recordId);
    // El núcleo (ids sin ':') no se puede desmontar: es la base legal del expediente.
    if (!sectionId.includes(':')) return;
    record.removeSection(sectionId);
    await this.records.save(record);
  }
}
