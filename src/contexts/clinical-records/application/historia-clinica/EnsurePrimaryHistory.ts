import { randomUUID } from 'node:crypto';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { ClinicalRecord } from '../../domain/ClinicalRecord';
import { historiaNucleoSections } from '../../domain/historiaBlocks';
import { modelComposesWithGeneralNucleo, modelDescriptorForTemplateId } from '../../domain/modelKeys';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';

/**
 * Garantiza que el paciente tenga su historia clínica primaria (consolidada).
 * Si no existe, la crea con el NÚCLEO del modelo elegido (§1: "Iniciar historia
 * clínica = elegir una plantilla-modelo que aporta el núcleo"); sin modelo, usa
 * el núcleo general transversal. Los modelos cuyo núcleo es específico del
 * enfoque (§3) se componen sobre la admisión general. Idempotente: si ya existe
 * una historia primaria, la devuelve sin tocarla (ignora el modelo).
 *
 * El repositorio de plantillas es opcional: sin él (o sin templateId) se usa el
 * núcleo general, conservando la firma original.
 */
export class EnsurePrimaryHistory {
  public constructor(
    private readonly records: ClinicalRecordRepository,
    private readonly templates?: ClinicalTemplateRepository,
  ) {}

  /**
   * @param force `true` abre SIEMPRE una primaria nueva aunque ya haya una abierta
   *   (nuevo episodio que coexiste): la recién creada será la vigente y la anterior
   *   queda abierta/editable. Sin `force` es idempotente (no crea una segunda).
   */
  public async ensure(patientId: string, templateId?: string | null, force = false): Promise<string> {
    if (!force) {
      const existing = await this.records.findPrimaryHistory(patientId);
      if (existing) return existing.recordId();
    }
    const record = ClinicalRecord.start({
      id: randomUUID(),
      patientId,
      templateId: null,
      title: await this.titleFor(templateId ?? null),
      sections: await this.nucleoFor(templateId ?? null),
      kind: 'historia',
    });
    await this.records.save(record);
    return record.recordId();
  }

  /** Núcleo de la historia primaria para el modelo elegido (o el general). */
  private async nucleoFor(templateId: string | null): Promise<ClinicalSection[]> {
    if (!templateId || !this.templates) return historiaNucleoSections();
    const template = await this.templates.findById(templateId);
    if (!template) return historiaNucleoSections();
    const own = template.toPrimitives().sections.filter((section) => section.id !== 'notas-adicionales');
    const model = modelDescriptorForTemplateId(templateId);
    // El modelo aporta admisión específica que se compone sobre la general (§3).
    if (model && modelComposesWithGeneralNucleo(model.key)) {
      return [...historiaNucleoSections(), ...own];
    }
    // General o modelos legacy autocontenidos: usan sus propias secciones.
    return own;
  }

  /** Título de la historia primaria, con el enfoque del modelo si aplica. */
  private async titleFor(templateId: string | null): Promise<string> {
    if (!templateId || !this.templates) return 'Historia clínica';
    const template = await this.templates.findById(templateId);
    if (!template) return 'Historia clínica';
    const enfoque = template.toPrimitives().therapyType.trim();
    return enfoque ? `Historia clínica · ${enfoque}` : 'Historia clínica';
  }
}
