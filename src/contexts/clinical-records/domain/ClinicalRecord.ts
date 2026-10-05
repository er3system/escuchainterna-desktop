import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { SealedRecordIsImmutableError } from './errors/SealedRecordIsImmutableError';

/** Valor de respuesta de un campo: texto simple o lista (casillas). */
export type ClinicalAnswerValue = string | string[];

export type ClinicalAnswers = Record<string, ClinicalAnswerValue>;

/** 'historia' = la historia clínica primaria (consolidada) del paciente. */
export type ClinicalRecordKind = 'historia' | 'registro';

export interface ClinicalRecordPrimitives {
  id: string;
  patientId: string;
  templateId: string | null;
  title: string;
  answers: ClinicalAnswers;
  /**
   * Secciones propias compuestas (núcleo + bloques añadidos). null = usar las
   * de la plantilla (`templateId`). La historia clínica consolidada las lleva.
   */
  sections?: ClinicalSection[] | null;
  kind?: ClinicalRecordKind;
  /**
   * Fecha de sellado (ISO) de una historia primaria cerrada para abrir otra.
   * null = vigente (editable). Con valor = sellada (solo lectura), preservada.
   */
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Historia clínica de un paciente: instancia de una plantilla (o en blanco)
 * con las respuestas del formulario {fieldId: valor}.
 */
export class ClinicalRecord extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly templateId: string | null,
    private title: string,
    private answers: ClinicalAnswers,
    private sections: ClinicalSection[] | null,
    private kind: ClinicalRecordKind,
    private closedAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  public static start(input: {
    id: string;
    patientId: string;
    templateId: string | null;
    title: string;
    /** Secciones propias (historia consolidada). Si se omite, usa la plantilla. */
    sections?: ClinicalSection[] | null;
    kind?: ClinicalRecordKind;
  }): ClinicalRecord {
    const now = new Date();
    return new ClinicalRecord(
      input.id,
      input.patientId,
      input.templateId,
      input.title,
      {},
      input.sections ?? null,
      input.kind ?? 'registro',
      null,
      now,
      now,
    );
  }

  public static fromPrimitives(primitives: ClinicalRecordPrimitives): ClinicalRecord {
    return new ClinicalRecord(
      primitives.id,
      primitives.patientId,
      primitives.templateId,
      primitives.title,
      primitives.answers,
      primitives.sections ?? null,
      primitives.kind ?? 'registro',
      primitives.closedAt ? new Date(primitives.closedAt) : null,
      new Date(primitives.createdAt),
      new Date(primitives.updatedAt),
    );
  }

  public answerField(fieldId: string, value: ClinicalAnswerValue): void {
    this.assertEditable();
    const isEmpty = Array.isArray(value) ? value.length === 0 : value.trim() === '';
    if (isEmpty) {
      delete this.answers[fieldId];
    } else {
      this.answers[fieldId] = value;
    }
    this.updatedAt = new Date();
  }

  public answerMany(answers: ClinicalAnswers): void {
    this.assertEditable();
    for (const [fieldId, value] of Object.entries(answers)) {
      this.answerField(fieldId, value);
    }
  }

  public rename(title: string): void {
    this.assertEditable();
    if (title.trim().length > 0) {
      this.title = title.trim();
      this.updatedAt = new Date();
    }
  }

  public recordId(): string {
    return this.id;
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  /** ¿Es la historia clínica primaria (consolidada) del paciente? */
  public isPrimaryHistory(): boolean {
    return this.kind === 'historia';
  }

  /** ¿Está sellada (cerrada para abrir otro expediente)? Solo lectura. */
  public isSealed(): boolean {
    return this.closedAt !== null;
  }

  public sealedAt(): string | null {
    return this.closedAt ? this.closedAt.toISOString() : null;
  }

  /**
   * Sella esta historia primaria: deja de ser editable y se preserva como
   * "expediente anterior". Continuidad clínica: nunca se borra contenido, solo
   * se cierra para abrir uno nuevo. Idempotente (no repisa la primera fecha).
   */
  public seal(): void {
    if (this.closedAt !== null) return;
    this.closedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Invariante de inmutabilidad: un expediente sellado no se puede mutar por
   * ninguna ruta (UI o acción directa). Los mutadores lo invocan al entrar.
   */
  private assertEditable(): void {
    if (this.closedAt !== null) throw new SealedRecordIsImmutableError();
  }

  /**
   * Degrada la historia primaria a "registro aparte" (cambiar de formato §P3):
   * conserva TODO el contenido pero deja de ser la primaria, para poder iniciar una
   * nueva con otro modelo sin perder lo escrito. Idempotente.
   */
  public demoteToRegistro(): void {
    this.assertEditable();
    if (this.kind === 'registro') return;
    this.kind = 'registro';
    this.updatedAt = new Date();
  }

  /** Secciones propias compuestas (o null si usa las de la plantilla). */
  public ownSections(): ClinicalSection[] | null {
    return this.sections ? this.sections.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) })) : null;
  }

  /**
   * Añade un bloque (sección) a la historia consolidada. Evita duplicar por id
   * de sección. Asume que el caso de uso ya garantizó ids únicos (namespaced).
   */
  public addSection(section: ClinicalSection): void {
    this.assertEditable();
    const current = this.sections ?? [];
    if (current.some((existing) => existing.id === section.id)) return;
    this.sections = [...current, section];
    this.updatedAt = new Date();
  }

  /**
   * Quita una sección (bloque) por id Y poda sus respuestas namespaced
   * (`${sectionId}::campo`). Sin la poda, el contenido del bloque quedaría
   * huérfano en answers y reaparecería al re-añadir el mismo bloque (ids
   * deterministas). Mantiene la consistencia sección<->respuestas.
   */
  public removeSection(sectionId: string): void {
    this.assertEditable();
    if (!this.sections) return;
    const next = this.sections.filter((section) => section.id !== sectionId);
    if (next.length === this.sections.length) return;
    this.sections = next;
    const prefix = `${sectionId}::`;
    for (const key of Object.keys(this.answers)) {
      if (key === sectionId || key.startsWith(prefix)) delete this.answers[key];
    }
    this.updatedAt = new Date();
  }

  public toPrimitives(): ClinicalRecordPrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      templateId: this.templateId,
      title: this.title,
      answers: { ...this.answers },
      sections: this.sections ? this.sections.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) })) : null,
      kind: this.kind,
      closedAt: this.closedAt ? this.closedAt.toISOString() : null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
