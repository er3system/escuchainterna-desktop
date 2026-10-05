import { describe, it, expect } from 'vitest';
import { buildPortfolioMarkdown, portfolioCode, type PortfolioCase } from '@/contexts/patients/domain/portfolio';

describe('portafolio pseudonimizado (§3.4)', () => {
  it('asigna códigos estables A, B, … Z, A1, …', () => {
    expect(portfolioCode(0)).toBe('A');
    expect(portfolioCode(1)).toBe('B');
    expect(portfolioCode(25)).toBe('Z');
    expect(portfolioCode(26)).toBe('A1');
    expect(portfolioCode(27)).toBe('B1');
  });

  it('arma markdown con datos estructurados y SIN identificadores del paciente', () => {
    const cases: PortfolioCase[] = [
      {
        code: 'A',
        approach: 'Historia clínica · TREC',
        sessionCount: 8,
        diagnoses: ['6A70 — Episodio depresivo'],
        firstDate: '2026-01-10T09:00:00.000Z',
        lastDate: '2026-05-20T10:00:00.000Z',
      },
    ];
    const md = buildPortfolioMarkdown({
      generatedAt: '2026-06-14T12:00:00.000Z',
      professionalName: 'Dra. Ana López',
      organizationName: 'Universidad Demo',
      cases,
    });

    expect(md).toContain('# Portafolio de casos (pseudonimizado)');
    expect(md).toContain('Dra. Ana López'); // el PROFESIONAL sí va (es suyo)
    expect(md).toContain('Casos atendidos: 1');
    expect(md).toContain('### Paciente A'); // código, no nombre
    expect(md).toContain('Historia clínica · TREC');
    expect(md).toContain('**Sesiones:** 8');
    expect(md).toContain('6A70 — Episodio depresivo');
    expect(md).toContain('2026-01-10 → 2026-05-20'); // fechas conservadas
  });

  it('sin casos lo dice explícitamente', () => {
    const md = buildPortfolioMarkdown({
      generatedAt: '2026-06-14T12:00:00.000Z',
      professionalName: 'Dr. X',
      organizationName: 'Org',
      cases: [],
    });
    expect(md).toContain('Casos atendidos: 0');
    expect(md).toContain('Sin casos registrados.');
  });
});
