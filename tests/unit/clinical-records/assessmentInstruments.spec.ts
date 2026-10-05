import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_INSTRUMENTS,
  findInstrument,
  scoreAssessment,
} from '@/contexts/clinical-records/domain/assessmentInstruments';

describe('assessmentInstruments', () => {
  it('cada instrumento es coherente: bandas cubren 0..maxScore sin huecos y maxScore = ítems × opción máxima', () => {
    for (const instrument of ASSESSMENT_INSTRUMENTS) {
      const maxOption = Math.max(...instrument.options.map((o) => o.value));
      expect(instrument.maxScore).toBe(instrument.items.length * maxOption);
      // Las bandas, ordenadas, cubren contiguo desde 0 hasta maxScore.
      const bands = [...instrument.severityBands].sort((a, b) => a.min - b.min);
      expect(bands[0].min).toBe(0);
      expect(bands[bands.length - 1].max).toBe(instrument.maxScore);
      for (let i = 1; i < bands.length; i += 1) {
        expect(bands[i].min).toBe(bands[i - 1].max + 1);
      }
    }
  });

  it('PHQ-9: suma, banda de severidad y alerta de riesgo por el ítem 9', () => {
    const phq9 = findInstrument('phq-9')!;
    // Todo en 0 → mínima, sin riesgo.
    const min = scoreAssessment(phq9, new Array(9).fill(0));
    expect(min.total).toBe(0);
    expect(min.severity?.label).toBe('Mínima');
    expect(min.riskFlag).toBe(false);

    // Máximo (todo 3) → 27, grave, con riesgo (ítem 9 > 0).
    const max = scoreAssessment(phq9, new Array(9).fill(3));
    expect(max.total).toBe(27);
    expect(max.severity?.label).toBe('Grave');
    expect(max.riskFlag).toBe(true);

    // Ideación aislada: solo el ítem de riesgo en 1 → total 1 (mínima) pero riesgo true.
    const ideation = new Array(9).fill(0);
    ideation[8] = 1;
    const risk = scoreAssessment(phq9, ideation);
    expect(risk.total).toBe(1);
    expect(risk.riskFlag).toBe(true);
  });

  it('GAD-7: 10 cae en Moderada y no tiene ítem de riesgo', () => {
    const gad7 = findInstrument('gad-7')!;
    const answers = [3, 3, 2, 2, 0, 0, 0];
    const result = scoreAssessment(gad7, answers);
    expect(result.total).toBe(10);
    expect(result.severity?.label).toBe('Moderada');
    expect(result.riskFlag).toBe(false);
  });

  it('ignora respuestas fuera de rango o faltantes (las trata como 0)', () => {
    const phq9 = findInstrument('phq-9')!;
    const result = scoreAssessment(phq9, [9, -1, 2]);
    // 9 y -1 fuera de [0,3] → 0; solo el 2 cuenta; faltantes → 0.
    expect(result.total).toBe(2);
  });

  it('findInstrument devuelve null para id desconocido', () => {
    expect(findInstrument('nope')).toBeNull();
  });
});
