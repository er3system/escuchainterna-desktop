import { describe, it, expect } from 'vitest';
import {
  baseOption,
  composeOther,
  findOtherOption,
  isOtherOption,
  matchesOption,
  optionsWithOther,
  otherDetail,
  resolveOtherOption,
  SYNTHETIC_OTHER_OPTION,
} from '@/components/clinical/otherOption';

describe('otherOption — patrón "Otro → ¿cuáles?" (expediente v2 §4)', () => {
  it('reconoce las opciones tipo "Otro/Otra/Otras" sin acentos ni mayúsculas', () => {
    expect(isOtherOption('Otro')).toBe(true);
    expect(isOtherOption('Otra')).toBe(true);
    expect(isOtherOption('Otras')).toBe(true);
    expect(isOtherOption('OTRO')).toBe(true);
    expect(isOtherOption('Alcohol')).toBe(false);
    expect(isOtherOption('Ninguna')).toBe(false);
  });

  it('encuentra la opción "Otro" dentro de una lista de opciones', () => {
    expect(findOtherOption(['Alcohol', 'Tabaco', 'Otras', 'Ninguna'])).toBe('Otras');
    expect(findOtherOption(['Sí', 'No'])).toBeUndefined();
    expect(findOtherOption(undefined)).toBeUndefined();
  });

  it('compone y descompone el valor anotado de forma reversible', () => {
    const composed = composeOther('Otras', '  ketamina  ');
    expect(composed).toBe('Otras: ketamina');
    expect(baseOption(composed)).toBe('Otras');
    expect(otherDetail(composed)).toBe('ketamina');
  });

  it('sin aclaración guarda solo la opción (sin separador colgante)', () => {
    expect(composeOther('Otra', '')).toBe('Otra');
    expect(composeOther('Otra', '   ')).toBe('Otra');
    expect(otherDetail('Otra')).toBe('');
  });

  it('no confunde un valor normal que contenga ": " con una anotación', () => {
    const normal = 'Consumo: en mayor cantidad de lo previsto';
    // El head ("Consumo") no es una opción "Otro" → se devuelve intacto.
    expect(baseOption(normal)).toBe(normal);
    expect(otherDetail(normal)).toBe('');
  });

  it('matchesOption empareja por opción base aunque venga anotado', () => {
    expect(matchesOption('Otras: ketamina', 'Otras')).toBe(true);
    expect(matchesOption('Alcohol', 'Alcohol')).toBe(true);
    expect(matchesOption('Otras: ketamina', 'Alcohol')).toBe(false);
  });

  describe('resolveOtherOption — las casillas admiten "otra" por defecto', () => {
    it('casillas: "otra" por defecto (sintética) y desactivable con allowsOther:false', () => {
      expect(resolveOtherOption({ type: 'casillas', options: ['A', 'B'] })).toBe(SYNTHETIC_OTHER_OPTION);
      expect(resolveOtherOption({ type: 'casillas', options: ['A', 'B'], allowsOther: false })).toBeUndefined();
    });

    it('casillas con una opción "Otra…" propia: usa esa, no la sintética', () => {
      expect(resolveOtherOption({ type: 'casillas', options: ['A', 'Otras'] })).toBe('Otras');
      expect(resolveOtherOption({ type: 'casillas', options: ['Madre', 'Otro tutor'] })).toBe('Otro tutor');
    });

    it('selección y opción múltiple: solo con allowsOther:true (opt-in)', () => {
      expect(resolveOtherOption({ type: 'seleccion', options: ['Sí', 'No'] })).toBeUndefined();
      expect(resolveOtherOption({ type: 'opcion_multiple', options: ['Sí', 'No'] })).toBeUndefined();
      expect(resolveOtherOption({ type: 'seleccion', options: ['A'], allowsOther: true })).toBe(SYNTHETIC_OTHER_OPTION);
    });

    it('optionsWithOther añade la sintética solo si no hay ya una "Otra…"', () => {
      expect(optionsWithOther(['A', 'B'], SYNTHETIC_OTHER_OPTION)).toEqual(['A', 'B', SYNTHETIC_OTHER_OPTION]);
      expect(optionsWithOther(['A', 'Otras'], 'Otras')).toEqual(['A', 'Otras']);
      expect(optionsWithOther(['A'], undefined)).toEqual(['A']);
    });
  });
});
