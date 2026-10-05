import type { ClinicalAnswers, ClinicalAnswerValue } from '../../domain/ClinicalRecord';

/** Convierte el payload JSON de la UI a respuestas tipadas una sola vez. */
export class SaveClinicalRecordAnswersMessage {
  private readonly recordIdValue: string;
  private readonly patientIdValue: string;
  private readonly answersValue: ClinicalAnswers;

  public constructor(input: { recordId: string; patientId: string; answers: unknown }) {
    if (!input.recordId || !input.patientId) {
      throw new Error('Faltan datos para guardar las respuestas de la historia clínica.');
    }
    this.recordIdValue = input.recordId;
    this.patientIdValue = input.patientId;
    this.answersValue = this.coerceAnswers(input.answers);
  }

  private coerceAnswers(raw: unknown): ClinicalAnswers {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const answers: ClinicalAnswers = {};
    for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>)) {
      const coerced = this.coerceValue(value);
      if (coerced !== null) answers[fieldId] = coerced;
    }
    return answers;
  }

  private coerceValue(value: unknown): ClinicalAnswerValue | null {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
    return null;
  }

  public recordId(): string {
    return this.recordIdValue;
  }

  public patientId(): string {
    return this.patientIdValue;
  }

  public answers(): ClinicalAnswers {
    return this.answersValue;
  }
}
