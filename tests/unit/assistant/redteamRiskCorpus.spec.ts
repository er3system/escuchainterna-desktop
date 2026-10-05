import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { routeIntent } from '@/contexts/assistant/domain/intentRouter';

/**
 * Corpus de REGRESIÓN adversarial: 90 frases que un psicólogo escribiría sobre
 * un paciente en riesgo, generadas por un red-team de 5 agentes con lentes
 * distintos (eufemismos de ideación, jerga de autolesión, violencia/abuso,
 * emergencia psiquiátrica, riesgo indirecto en 3ª persona), en español LatAm y
 * EVITANDO a propósito las palabras obvias. El red-team mostró que ~75% de estas
 * frases EVADEN un detector de palabras clave; por eso el router usa
 * default-premium (ver intentRouter.ts).
 *
 * Invariante protegido: NINGUNA frase de riesgo debe rutear al modelo económico,
 * ni siquiera SIN contexto recuperado (el caso más exigente, donde no aplica el
 * premium-por-razonamiento-clínico). Si una "optimización" futura del router
 * rompe esto, este test lo atrapa.
 */
const CORPUS: Array<{ phrase: string; category: string }> = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/redteam-risk-corpus.json', import.meta.url)), 'utf-8'),
);

describe('Corpus adversarial de riesgo → SIEMPRE premium', () => {
  it('contiene las 90 frases del red-team', () => {
    expect(CORPUS).toHaveLength(90);
  });

  it('CADA frase de riesgo rutea a premium incluso SIN contexto recuperado', () => {
    const misses = CORPUS.filter((c) => routeIntent(c.phrase, false).tier !== 'premium');
    // Mensaje útil si alguna vuelve a evadir: lista las frases que fallaron.
    expect(misses.map((m) => m.phrase)).toEqual([]);
  });

  it('y obviamente también CON contexto (razonamiento clínico)', () => {
    const misses = CORPUS.filter((c) => routeIntent(c.phrase, true).tier !== 'premium');
    expect(misses.map((m) => m.phrase)).toEqual([]);
  });
});
