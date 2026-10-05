import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';
import type { PatientFileRepository } from '../../domain/repositories/PatientFileRepository';
import type { PatientDirectory, PatientSummary } from '../../domain/repositories/PatientDirectory';
import type { DiagnosisPrimitives } from '../../domain/Diagnosis';
import { BLANK_RECORD_SECTIONS } from '../../domain/blankRecordSections';

export interface RecordExportOptions {
  includePatientData: boolean;
  includeRecords: boolean;
  includeNotes: boolean;
  includeDiagnoses: boolean;
  includeFiles: boolean;
}

export interface ExportedQuestion {
  label: string;
  answer: string;
}

export interface ExportedRecordSection {
  title: string;
  description?: string;
  questions: ExportedQuestion[];
}

export interface ExportedRecord {
  title: string;
  templateName: string;
  /** 'historia' (primaria consolidada) | 'registro' (módulo/plantilla suelta). */
  kind: string;
  /** Expediente sellado (solo lectura): historia de un episodio/tratante anterior. */
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  sections: ExportedRecordSection[];
}

export interface ExportedNote {
  title: string;
  content: string;
  createdAt: string;
}

export interface ExportedFile {
  filename: string;
  mime: string;
  size: number;
  uploadedAt: string;
}

export interface RecordExport {
  generatedAt: string;
  patient: PatientSummary;
  patientData: PatientSummary | null;
  records: ExportedRecord[];
  notes: ExportedNote[];
  diagnoses: DiagnosisPrimitives[];
  files: ExportedFile[];
}

/** Construye la estructura completa del expediente para la vista imprimible. */
export class BuildRecordExport {
  public constructor(
    private readonly patients: PatientDirectory,
    private readonly records: ClinicalRecordRepository,
    private readonly templates: ClinicalTemplateRepository,
    private readonly notes: SessionNoteRepository,
    private readonly diagnoses: DiagnosisRepository,
    private readonly files: PatientFileRepository,
  ) {}

  public async execute(patientId: string, options: RecordExportOptions): Promise<RecordExport | null> {
    const patient = await this.patients.findSummary(patientId);
    if (!patient) return null;

    return {
      generatedAt: new Date().toISOString(),
      patient,
      patientData: options.includePatientData ? patient : null,
      records: options.includeRecords ? await this.exportRecords(patientId) : [],
      notes: options.includeNotes ? await this.exportNotes(patientId) : [],
      diagnoses: options.includeDiagnoses
        ? (await this.diagnoses.listByPatient(patientId)).map((diagnosis) => diagnosis.toPrimitives())
        : [],
      files: options.includeFiles ? await this.exportFiles(patientId) : [],
    };
  }

  private async exportRecords(patientId: string): Promise<ExportedRecord[]> {
    const records = await this.records.listByPatient(patientId);
    const exported: ExportedRecord[] = [];
    for (const record of records) {
      const primitives = record.toPrimitives();
      let templateName = 'En blanco';
      let sections: ClinicalSection[] = BLANK_RECORD_SECTIONS;
      if (primitives.sections && primitives.sections.length > 0) {
        // Historia consolidada (núcleo + bloques): usa sus propias secciones.
        sections = primitives.sections;
        templateName =
          primitives.kind === 'historia'
            ? primitives.closedAt
              ? 'Historia clínica (expediente anterior, sellado)'
              : 'Historia clínica consolidada'
            : 'Personalizada';
      } else if (primitives.templateId) {
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
      const exportedSections: ExportedRecordSection[] = sections
        .map((section) => ({
          title: section.title,
          description: section.description,
          questions: section.fields
            .map((field) => {
              const value = primitives.answers[field.id];
              const answer = Array.isArray(value) ? value.join(', ') : (value ?? '');
              return { label: field.label, answer };
            })
            .filter((question) => question.answer !== ''),
        }))
        .filter((section) => section.questions.length > 0);
      exported.push({
        title: primitives.title,
        templateName,
        kind: primitives.kind ?? 'registro',
        closed: Boolean(primitives.closedAt),
        createdAt: primitives.createdAt,
        updatedAt: primitives.updatedAt,
        sections: exportedSections,
      });
    }
    return exported;
  }

  private async exportNotes(patientId: string): Promise<ExportedNote[]> {
    return (await this.notes.listByPatient(patientId))
      .map((note) => note.toPrimitives())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((note) => ({ title: note.title, content: note.content, createdAt: note.createdAt }));
  }

  private async exportFiles(patientId: string): Promise<ExportedFile[]> {
    return (await this.files.listByPatient(patientId))
      .map((file) => file.toPrimitives())
      .map((file) => ({ filename: file.filename, mime: file.mime, size: file.size, uploadedAt: file.uploadedAt }));
  }
}
