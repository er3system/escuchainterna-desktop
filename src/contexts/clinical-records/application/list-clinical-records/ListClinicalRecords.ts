import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import { BLANK_RECORD_SECTIONS } from '../../domain/blankRecordSections';

export interface ClinicalRecordSummary {
  id: string;
  title: string;
  templateId: string | null;
  templateName: string;
  createdAt: string;
  updatedAt: string;
  totalFields: number;
  answeredFields: number;
}

export class ListClinicalRecords {
  public constructor(
    private readonly records: ClinicalRecordRepository,
    private readonly templates: ClinicalTemplateRepository,
  ) {}

  public async execute(patientId: string): Promise<ClinicalRecordSummary[]> {
    const records = await this.records.listByPatient(patientId);
    const summaries: ClinicalRecordSummary[] = [];
    for (const record of records) {
      const primitives = record.toPrimitives();
      let templateName = 'En blanco';
      let sections: ClinicalSection[] = BLANK_RECORD_SECTIONS;
      if (primitives.templateId) {
        const template = await this.templates.findById(primitives.templateId);
        if (template) {
          const templatePrimitives = template.toPrimitives();
          templateName = templatePrimitives.name;
          sections = templatePrimitives.sections;
        } else {
          templateName = 'Plantilla eliminada';
          sections = [];
        }
      }
      const fieldIds = sections.flatMap((section) => section.fields.map((field) => field.id));
      const answeredFields = fieldIds.filter((fieldId) => primitives.answers[fieldId] !== undefined).length;
      summaries.push({
        id: primitives.id,
        title: primitives.title,
        templateId: primitives.templateId,
        templateName,
        createdAt: primitives.createdAt,
        updatedAt: primitives.updatedAt,
        totalFields: fieldIds.length,
        answeredFields,
      });
    }
    return summaries;
  }
}
