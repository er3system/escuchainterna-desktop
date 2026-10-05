import { randomUUID } from 'node:crypto';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClinicalRecord } from '../../domain/ClinicalRecord';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import { TemplateNotFoundError } from '../../domain/errors/TemplateNotFoundError';
import type { StartClinicalRecordMessage } from './StartClinicalRecordMessage';

export class StartClinicalRecord {
  public constructor(
    private readonly records: ClinicalRecordRepository,
    private readonly templates: ClinicalTemplateRepository,
  ) {}

  /** Crea la historia (desde plantilla o en blanco) y devuelve su id. */
  public async execute(message: StartClinicalRecordMessage): Promise<string> {
    const templateId = message.templateId();
    let baseTitle = 'Historia en blanco';
    if (templateId) {
      const template = await this.templates.findById(templateId);
      if (!template) throw new TemplateNotFoundError(templateId);
      baseTitle = template.toPrimitives().name;
    }
    const dateLabel = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
    const record = ClinicalRecord.start({
      id: randomUUID(),
      patientId: message.patientId(),
      templateId,
      title: `${baseTitle} — ${dateLabel}`,
    });
    await this.records.save(record);
    return record.recordId();
  }
}
