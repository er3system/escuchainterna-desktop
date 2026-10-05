import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import type { ClinicalAnswers, ClinicalAnswerValue } from './ClinicalRecord';
import type { SessionKind } from './sessionTemplates';

export interface SessionNotePrimitives {
  id: string;
  patientId: string;
  bookingId: string | null;
  title: string;
  content: string;
  /** Plantilla de sesión estructurada (1ª/seguimiento). null = solo texto libre. */
  templateId: string | null;
  /** Respuestas del formulario estructurado {fieldId: valor}. */
  answers: ClinicalAnswers;
  /**
   * Bloques curados añadidos a ESTA sesión (P6.1): secciones propias con ids
   * namespaced (`bloque:<x>`). null/ausente = sin bloques. Las respuestas de sus
   * campos viven en `answers` con la clave `bloque:<x>::campo`.
   */
  sections?: ClinicalSection[] | null;
  sessionKind: SessionKind;
  /** Archivada: quitada de la Evolución sin borrarla (recuperable). Retrocompatible. */
  archived?: boolean;
  /** Orden manual en la Evolución (P8): ASC = más antigua/arriba. Retrocompatible. */
  position?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Nota de sesión: texto libre del profesional + (opcional) formulario
 * estructurado por plantilla de sesión, opcionalmente ligada a una reserva.
 */
export class SessionNote extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly patientId: string,
    private readonly bookingId: string | null,
    private title: string,
    private content: string,
    private readonly templateId: string | null,
    private answers: ClinicalAnswers,
    private sections: ClinicalSection[] | null,
    private readonly sessionKind: SessionKind,
    private archived: boolean,
    private positionValue: number,
    private readonly createdAt: Date,
    private updatedAt: Date,
  ) {
    super();
  }

  public static create(input: {
    id: string;
    patientId: string;
    bookingId: string | null;
    title: string;
    templateId?: string | null;
    sessionKind?: SessionKind;
    position?: number;
  }): SessionNote {
    const now = new Date();
    return new SessionNote(
      input.id,
      input.patientId,
      input.bookingId,
      input.title,
      '',
      input.templateId ?? null,
      {},
      null,
      input.sessionKind ?? 'seguimiento',
      false,
      input.position ?? 0,
      now,
      now,
    );
  }

  public static fromPrimitives(primitives: SessionNotePrimitives): SessionNote {
    return new SessionNote(
      primitives.id,
      primitives.patientId,
      primitives.bookingId,
      primitives.title,
      primitives.content,
      primitives.templateId,
      primitives.answers,
      primitives.sections ?? null,
      primitives.sessionKind,
      primitives.archived ?? false,
      primitives.position ?? 0,
      new Date(primitives.createdAt),
      new Date(primitives.updatedAt),
    );
  }

  public edit(title: string, content: string): void {
    this.title = title.trim() === '' ? 'Nueva sesión' : title.trim();
    this.content = content;
    this.updatedAt = new Date();
  }

  /** Reemplaza TODAS las respuestas del formulario estructurado (poda vacíos). */
  public updateAnswers(answers: ClinicalAnswers): void {
    const next: ClinicalAnswers = {};
    for (const [fieldId, value] of Object.entries(answers)) {
      const isEmpty = Array.isArray(value) ? value.length === 0 : value.trim() === '';
      if (!isEmpty) next[fieldId] = value;
    }
    this.answers = next;
    this.updatedAt = new Date();
  }

  /**
   * Funde un subconjunto de respuestas SIN borrar las demás (set/delete por
   * campo). Necesario ahora que las respuestas de una sesión vienen de varias
   * fuentes independientes (formulario base + cada bloque): guardar una sección
   * no debe pisar las respuestas de las otras. Vacío = elimina ese campo.
   */
  public mergeAnswers(answers: ClinicalAnswers): void {
    for (const [fieldId, value] of Object.entries(answers)) {
      const isEmpty = Array.isArray(value) ? value.length === 0 : value.trim() === '';
      if (isEmpty) delete this.answers[fieldId];
      else this.answers[fieldId] = value;
    }
    this.updatedAt = new Date();
  }

  /** Bloques propios añadidos a la sesión (o null si no tiene). Copia profunda. */
  public ownSections(): ClinicalSection[] | null {
    return this.sections
      ? this.sections.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) }))
      : null;
  }

  /**
   * Añade un bloque (sección) a la sesión. Evita duplicar por id. Asume que el
   * caso de uso ya garantizó ids únicos (namespaced con `bloque:<x>`).
   */
  public addSection(section: ClinicalSection): void {
    const current = this.sections ?? [];
    if (current.some((existing) => existing.id === section.id)) return;
    this.sections = [...current, section];
    this.updatedAt = new Date();
  }

  /**
   * Quita un bloque de la sesión por id de sección Y poda sus respuestas
   * namespaced (`${sectionId}::campo`). Sin esta poda, el contenido clínico del
   * bloque quedaría huérfano en answers y REAPARECERÍA al re-añadir el mismo
   * bloque (sus ids son deterministas), mostrando datos que el profesional creía
   * borrados. La sección<->respuestas se mantiene consistente.
   */
  public removeSection(sectionId: string): void {
    if (!this.sections) return;
    const next = this.sections.filter((section) => section.id !== sectionId);
    if (next.length === this.sections.length) return;
    this.sections = next.length > 0 ? next : null;
    const prefix = `${sectionId}::`;
    for (const key of Object.keys(this.answers)) {
      if (key === sectionId || key.startsWith(prefix)) delete this.answers[key];
    }
    this.updatedAt = new Date();
  }

  /** Archiva la sesión: la quita de la Evolución sin borrarla (recuperable). Idempotente. */
  public archive(): void {
    if (this.archived) return;
    this.archived = true;
    this.updatedAt = new Date();
  }

  /** Restaura una sesión archivada a la Evolución. Idempotente. */
  public restore(): void {
    if (!this.archived) return;
    this.archived = false;
    this.updatedAt = new Date();
  }

  public isArchived(): boolean {
    return this.archived;
  }

  /** Orden manual en la Evolución (ASC = más antigua/arriba). */
  public position(): number {
    return this.positionValue;
  }

  /** Fija el orden manual de la sesión (reordenamiento de la Evolución, P8). */
  public placeAt(position: number): void {
    if (this.positionValue === position) return;
    this.positionValue = position;
    this.updatedAt = new Date();
  }

  public noteId(): string {
    return this.id;
  }

  public belongsTo(patientId: string): boolean {
    return this.patientId === patientId;
  }

  public currentContent(): string {
    return this.content;
  }

  public answerValue(fieldId: string): ClinicalAnswerValue | undefined {
    return this.answers[fieldId];
  }

  public kind(): SessionKind {
    return this.sessionKind;
  }

  public toPrimitives(): SessionNotePrimitives {
    return {
      id: this.id,
      patientId: this.patientId,
      bookingId: this.bookingId,
      title: this.title,
      content: this.content,
      templateId: this.templateId,
      answers: { ...this.answers },
      sections: this.sections
        ? this.sections.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f })) }))
        : null,
      sessionKind: this.sessionKind,
      archived: this.archived,
      position: this.positionValue,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
