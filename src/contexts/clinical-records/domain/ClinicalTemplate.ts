import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import type {
  ClinicalField,
  ClinicalFieldType,
  ClinicalSection,
} from '@/shared/infrastructure/persistence/builtinTemplates';
import { BuiltinTemplateIsReadOnlyError } from './errors/BuiltinTemplateIsReadOnlyError';
import { InvalidTemplateSectionsError } from './errors/InvalidTemplateSectionsError';

export const CLINICAL_FIELD_TYPES: ClinicalFieldType[] = [
  'texto_corto',
  'texto_largo',
  'fecha',
  'numero',
  'seleccion',
  'opcion_multiple',
  'casillas',
  'escala',
];

export interface ClinicalTemplatePrimitives {
  id: string;
  name: string;
  therapyType: string;
  description: string;
  sections: ClinicalSection[];
  isBuiltin: boolean;
  createdAt: string;
}

/**
 * Plantilla de historia clínica. Las integradas (is_builtin=1) son de solo
 * lectura; las personalizadas pueden editarse y eliminarse.
 */
export class ClinicalTemplate extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private name: string,
    private therapyType: string,
    private description: string,
    private sections: ClinicalSection[],
    private readonly isBuiltin: boolean,
    private readonly createdAt: Date,
  ) {
    super();
  }

  public static createCustom(input: {
    id: string;
    name: string;
    therapyType: string;
    description: string;
    sections: ClinicalSection[];
  }): ClinicalTemplate {
    return new ClinicalTemplate(
      input.id,
      input.name,
      input.therapyType,
      input.description,
      input.sections,
      false,
      new Date(),
    );
  }

  public static fromPrimitives(primitives: ClinicalTemplatePrimitives): ClinicalTemplate {
    return new ClinicalTemplate(
      primitives.id,
      primitives.name,
      primitives.therapyType,
      primitives.description,
      primitives.sections,
      primitives.isBuiltin,
      new Date(primitives.createdAt),
    );
  }

  public update(input: {
    name: string;
    therapyType: string;
    description: string;
    sections: ClinicalSection[];
  }): void {
    this.ensureEditable();
    this.name = input.name;
    this.therapyType = input.therapyType;
    this.description = input.description;
    this.sections = input.sections;
  }

  public ensureEditable(): void {
    if (this.isBuiltin) throw new BuiltinTemplateIsReadOnlyError(this.id);
  }

  public templateId(): string {
    return this.id;
  }

  public builtin(): boolean {
    return this.isBuiltin;
  }

  public toPrimitives(): ClinicalTemplatePrimitives {
    return {
      id: this.id,
      name: this.name,
      therapyType: this.therapyType,
      description: this.description,
      sections: this.sections.map((section) => ({ ...section, fields: section.fields.map((field) => ({ ...field })) })),
      isBuiltin: this.isBuiltin,
      createdAt: this.createdAt.toISOString(),
    };
  }
}

function isFieldType(value: unknown): value is ClinicalFieldType {
  return typeof value === 'string' && (CLINICAL_FIELD_TYPES as string[]).includes(value);
}

/**
 * Valida y normaliza las secciones recibidas de la UI (JSON sin tipar).
 * Genera ids cuando faltan y descarta basura silenciosa, pero exige al menos
 * una sección con al menos un campo con etiqueta.
 */
export function parseTemplateSections(raw: unknown): ClinicalSection[] {
  if (!Array.isArray(raw)) throw new InvalidTemplateSectionsError('Las secciones deben ser una lista.');
  const sections: ClinicalSection[] = [];
  let sectionIndex = 0;
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const candidate = item as Record<string, unknown>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    if (!title) continue;
    sectionIndex += 1;
    const fields: ClinicalField[] = [];
    const rawFields = Array.isArray(candidate.fields) ? candidate.fields : [];
    let fieldIndex = 0;
    for (const rawField of rawFields) {
      if (typeof rawField !== 'object' || rawField === null) continue;
      const fieldCandidate = rawField as Record<string, unknown>;
      const label = typeof fieldCandidate.label === 'string' ? fieldCandidate.label.trim() : '';
      if (!label) continue;
      fieldIndex += 1;
      const type = isFieldType(fieldCandidate.type) ? fieldCandidate.type : 'texto_corto';
      const field: ClinicalField = {
        id:
          typeof fieldCandidate.id === 'string' && fieldCandidate.id.trim()
            ? fieldCandidate.id.trim()
            : `campo-${sectionIndex}-${fieldIndex}`,
        label,
        type,
        required: fieldCandidate.required === true || undefined,
      };
      if (typeof fieldCandidate.placeholder === 'string' && fieldCandidate.placeholder.trim()) {
        field.placeholder = fieldCandidate.placeholder.trim();
      }
      if (typeof fieldCandidate.helpText === 'string' && fieldCandidate.helpText.trim()) {
        field.helpText = fieldCandidate.helpText.trim();
      }
      if (type === 'seleccion' || type === 'opcion_multiple' || type === 'casillas') {
        const options = Array.isArray(fieldCandidate.options)
          ? fieldCandidate.options.filter((option): option is string => typeof option === 'string' && option.trim() !== '').map((option) => option.trim())
          : [];
        if (options.length === 0) {
          throw new InvalidTemplateSectionsError(`El campo "${label}" necesita al menos una opción.`);
        }
        field.options = options;
      }
      if (type === 'escala') {
        const min = Number(fieldCandidate.scaleMin);
        const max = Number(fieldCandidate.scaleMax);
        field.scaleMin = Number.isFinite(min) ? Math.trunc(min) : 1;
        field.scaleMax = Number.isFinite(max) ? Math.trunc(max) : 10;
        if (field.scaleMax <= field.scaleMin) {
          throw new InvalidTemplateSectionsError(`La escala del campo "${label}" debe tener un máximo mayor que el mínimo.`);
        }
        if (field.scaleMax - field.scaleMin > 20) {
          throw new InvalidTemplateSectionsError(`La escala del campo "${label}" es demasiado amplia (máximo 20 pasos).`);
        }
        if (typeof fieldCandidate.scaleMinLabel === 'string' && fieldCandidate.scaleMinLabel.trim()) {
          field.scaleMinLabel = fieldCandidate.scaleMinLabel.trim();
        }
        if (typeof fieldCandidate.scaleMaxLabel === 'string' && fieldCandidate.scaleMaxLabel.trim()) {
          field.scaleMaxLabel = fieldCandidate.scaleMaxLabel.trim();
        }
      }
      fields.push(field);
    }
    if (fields.length === 0) {
      throw new InvalidTemplateSectionsError(`La sección "${title}" necesita al menos una pregunta con etiqueta.`);
    }
    sections.push({
      id:
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id.trim()
          : `seccion-${sectionIndex}`,
      title,
      description:
        typeof candidate.description === 'string' && candidate.description.trim()
          ? candidate.description.trim()
          : undefined,
      fields,
    });
  }
  if (sections.length === 0) {
    throw new InvalidTemplateSectionsError('La plantilla necesita al menos una sección con título y preguntas.');
  }
  return sections;
}
