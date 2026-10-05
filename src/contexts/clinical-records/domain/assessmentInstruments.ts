/**
 * Catálogo de instrumentos/escalas aplicables (módulo PURO: sin imports de Node).
 * Cuestionarios validados que el psicólogo APLICA al paciente y quedan con
 * puntaje + severidad + fecha, para seguir la evolución (tendencia). Distinto del
 * tipo de sesión "Prueba aplicada" (texto libre): esto es estructurado y puntuado.
 *
 * Traducciones estándar al español de PHQ-9 y GAD-7 (uso clínico habitual).
 */

export interface AssessmentOption {
  value: number;
  label: string;
}

export type SeverityTone = 'success' | 'caution' | 'warning' | 'danger';

export interface SeverityBand {
  min: number;
  max: number;
  label: string;
  tone: SeverityTone;
}

export interface AssessmentInstrument {
  id: string;
  name: string;
  /** Qué mide, para etiquetar (Depresión / Ansiedad). */
  measures: string;
  /** Encabezado/instrucción que ve el profesional al aplicarlo. */
  instruction: string;
  options: AssessmentOption[];
  items: string[];
  severityBands: SeverityBand[];
  maxScore: number;
  /**
   * Índice (0-based) de un ítem de riesgo (p. ej. ideación suicida en PHQ-9):
   * cualquier respuesta > 0 levanta una alerta. undefined si no aplica.
   */
  riskItemIndex?: number;
}

/** Opciones de frecuencia comunes a PHQ-9 y GAD-7 (últimas 2 semanas). */
const FREQUENCY_OPTIONS: AssessmentOption[] = [
  { value: 0, label: 'Nunca' },
  { value: 1, label: 'Varios días' },
  { value: 2, label: 'Más de la mitad de los días' },
  { value: 3, label: 'Casi todos los días' },
];

const PHQ9: AssessmentInstrument = {
  id: 'phq-9',
  name: 'PHQ-9',
  measures: 'Depresión',
  instruction:
    'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
  options: FREQUENCY_OPTIONS,
  items: [
    'Poco interés o placer en hacer las cosas',
    'Se ha sentido decaído(a), deprimido(a) o sin esperanza',
    'Dificultad para dormir o quedarse dormido(a), o dormir demasiado',
    'Cansancio o poca energía',
    'Poco apetito o comer en exceso',
    'Sentirse mal con usted mismo(a) — que es un fracaso o que ha quedado mal con usted o su familia',
    'Dificultad para concentrarse (leer, ver televisión)',
    'Moverse o hablar tan lento que otras personas lo notan; o lo contrario, estar tan inquieto(a) que se mueve mucho más de lo habitual',
    'Pensamientos de que estaría mejor muerto(a) o de hacerse daño de alguna manera',
  ],
  severityBands: [
    { min: 0, max: 4, label: 'Mínima', tone: 'success' },
    { min: 5, max: 9, label: 'Leve', tone: 'caution' },
    { min: 10, max: 14, label: 'Moderada', tone: 'warning' },
    { min: 15, max: 19, label: 'Moderadamente grave', tone: 'danger' },
    { min: 20, max: 27, label: 'Grave', tone: 'danger' },
  ],
  maxScore: 27,
  riskItemIndex: 8,
};

const GAD7: AssessmentInstrument = {
  id: 'gad-7',
  name: 'GAD-7',
  measures: 'Ansiedad',
  instruction:
    'Durante las últimas 2 semanas, ¿con qué frecuencia le han molestado los siguientes problemas?',
  options: FREQUENCY_OPTIONS,
  items: [
    'Sentirse nervioso(a), ansioso(a) o con los nervios de punta',
    'No poder dejar de preocuparse o no poder controlar la preocupación',
    'Preocuparse demasiado por diferentes cosas',
    'Dificultad para relajarse',
    'Estar tan inquieto(a) que es difícil permanecer sentado(a) tranquilo(a)',
    'Molestarse o irritarse fácilmente',
    'Sentir miedo como si algo terrible fuera a suceder',
  ],
  severityBands: [
    { min: 0, max: 4, label: 'Mínima', tone: 'success' },
    { min: 5, max: 9, label: 'Leve', tone: 'caution' },
    { min: 10, max: 14, label: 'Moderada', tone: 'warning' },
    { min: 15, max: 21, label: 'Grave', tone: 'danger' },
  ],
  maxScore: 21,
};

export const ASSESSMENT_INSTRUMENTS: AssessmentInstrument[] = [PHQ9, GAD7];

export function findInstrument(id: string): AssessmentInstrument | null {
  return ASSESSMENT_INSTRUMENTS.find((instrument) => instrument.id === id) ?? null;
}

export interface AssessmentScore {
  total: number;
  severity: SeverityBand | null;
  /** true si el ítem de riesgo (p. ej. ideación) fue respondido con > 0. */
  riskFlag: boolean;
}

/** Puntúa una aplicación: suma de respuestas + banda de severidad + alerta de riesgo. */
export function scoreAssessment(instrument: AssessmentInstrument, answers: number[]): AssessmentScore {
  const valid = instrument.options.map((option) => option.value);
  const maxOption = Math.max(...valid);
  let total = 0;
  for (let i = 0; i < instrument.items.length; i += 1) {
    const raw = answers[i];
    const value = typeof raw === 'number' && raw >= 0 && raw <= maxOption ? Math.trunc(raw) : 0;
    total += value;
  }
  const severity = instrument.severityBands.find((band) => total >= band.min && total <= band.max) ?? null;
  const riskFlag =
    instrument.riskItemIndex !== undefined && (answers[instrument.riskItemIndex] ?? 0) > 0;
  return { total, severity, riskFlag };
}
