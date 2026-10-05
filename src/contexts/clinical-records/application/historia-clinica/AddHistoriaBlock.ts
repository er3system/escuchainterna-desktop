import { historiaBlockCatalog, namespaceBlockSection } from '../../domain/historiaBlocks';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';

/**
 * Añade un bloque del catálogo (una sección de una plantilla integrada) a la
 * historia clínica consolidada. Los ids de la sección y de sus campos se
 * reescriben con el id del bloque para garantizar unicidad dentro de la
 * historia (evita colisiones de respuestas entre secciones de distintas
 * plantillas). Bloque desconocido = no-op; bloque ya presente = no duplica.
 */
export class AddHistoriaBlock {
  public constructor(private readonly records: ClinicalRecordRepository) {}

  public async add(recordId: string, patientId: string, blockId: string): Promise<void> {
    const record = await this.records.findById(recordId);
    // Pertenencia al paciente (no solo existencia), igual que AddSessionBlock: un
    // record de otro paciente del mismo dueño no debe poder mutarse.
    if (!record || !record.belongsTo(patientId)) throw new ClinicalRecordNotFoundError(recordId);
    const block = historiaBlockCatalog().find((candidate) => candidate.id === blockId);
    if (!block) return;
    record.addSection(namespaceBlockSection(block.id, block.section));
    await this.records.save(record);
  }
}
