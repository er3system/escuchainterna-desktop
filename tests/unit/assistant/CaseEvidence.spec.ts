import { describe, it, expect } from 'vitest';
import {
  contextToEvidence,
  parseAssistantMessage,
  renderGapsSection,
  renderSourcesSection,
} from '@/contexts/assistant/domain/caseEvidence';
import { LocalAssistantEngine } from '@/contexts/assistant/infrastructure/ai/LocalAssistantEngine';
import type { RetrievedPatientContext } from '@/contexts/assistant/domain/PatientContextRetriever';

/**
 * Citas a la fuente + análisis de huecos (idea de gbrain SIN su stack).
 * Caso pedido: paciente con 1 nota y SIN diagnóstico → la nota es fuente y
 * "No hay un diagnóstico CIE-11 registrado." es un hueco.
 */

function contextOneNoteNoDiagnosis(): RetrievedPatientContext {
  return {
    patient: {
      id: 'p1',
      fullName: 'Ana López',
      gender: 'femenino',
      birthDate: null,
      consultationReason: 'Ansiedad',
      therapyStartDate: null,
      tags: [],
    },
    diagnoses: [],
    recentNotes: [{ title: 'Encuadre', excerpt: 'Primera sesión: se establece encuadre.', createdAt: '2026-06-12T10:00:00.000Z' }],
    clinicalRecords: [],
    upcomingBookings: [],
  };
}

describe('contextToEvidence — 1 nota, sin diagnóstico', () => {
  it('la nota es una fuente citable', () => {
    const evidence = contextToEvidence(contextOneNoteNoDiagnosis());

    expect(evidence.hasAnyEvidence).toBe(true);
    expect(evidence.sources).toHaveLength(1);
    expect(evidence.sources[0].kind).toBe('nota');
    expect(evidence.sources[0].label).toContain('Encuadre');
    expect(evidence.sources[0].label).toContain('12 de junio de 2026');
  });

  it('"No hay un diagnóstico CIE-11 registrado." es un hueco', () => {
    const evidence = contextToEvidence(contextOneNoteNoDiagnosis());

    expect(evidence.gaps).toContain('No hay un diagnóstico CIE-11 registrado.');
    // Con nota presente, NO debe aparecer el hueco de "sin notas".
    expect(evidence.gaps).not.toContain('No hay notas de sesión registradas.');
    // Historia y citas ausentes también constan como huecos.
    expect(evidence.gaps).toContain('No hay historia clínica registrada.');
    expect(evidence.gaps).toContain('No hay próximas citas agendadas.');
  });
});

describe('renderSourcesSection / renderGapsSection', () => {
  it('numera las fuentes desde [1] bajo el encabezado "Fuentes"', () => {
    const evidence = contextToEvidence(contextOneNoteNoDiagnosis());
    const rendered = renderSourcesSection(evidence);
    expect(rendered.startsWith('**Fuentes**')).toBe(true);
    expect(rendered).toContain('[1] Nota del 12 de junio de 2026 — Encuadre');
  });

  it('lista los huecos bajo "Lo que no consta en el expediente"', () => {
    const evidence = contextToEvidence(contextOneNoteNoDiagnosis());
    const rendered = renderGapsSection(evidence);
    expect(rendered.startsWith('**Lo que no consta en el expediente**')).toBe(true);
    expect(rendered).toContain('- No hay un diagnóstico CIE-11 registrado.');
  });
});

describe('parseAssistantMessage — separa cuerpo, fuentes y huecos', () => {
  it('extrae las fuentes y huecos del texto generado', () => {
    const evidence = contextToEvidence(contextOneNoteNoDiagnosis());
    const content = [
      'Esto es lo que consta sobre Ana López. La sesión de encuadre quedó registrada [1].',
      renderSourcesSection(evidence),
      renderGapsSection(evidence),
    ].join('\n\n');

    const parsed = parseAssistantMessage(content);

    expect(parsed.body).toContain('encuadre quedó registrada [1]');
    expect(parsed.body).not.toContain('Fuentes');
    expect(parsed.body).not.toContain('Lo que no consta');
    expect(parsed.sources).toEqual(['Nota del 12 de junio de 2026 — Encuadre']);
    expect(parsed.gaps).toContain('No hay un diagnóstico CIE-11 registrado.');
  });

  it('un mensaje sin secciones devuelve solo cuerpo', () => {
    const parsed = parseAssistantMessage('Solo puedo ayudarte con información de tus pacientes.');
    expect(parsed.sources).toEqual([]);
    expect(parsed.gaps).toEqual([]);
    expect(parsed.body).toBe('Solo puedo ayudarte con información de tus pacientes.');
  });
});

describe('LocalAssistantEngine — respuesta determinista con citas + huecos', () => {
  it('cita la nota con [1] y declara el hueco del diagnóstico', async () => {
    const engine = new LocalAssistantEngine('Marta Ruiz');
    const answer = await engine.answer('¿Qué notas tengo de Ana López?', contextOneNoteNoDiagnosis());

    // Saludo personalizado y cita en el cuerpo (la marca [1] sigue a la nota).
    expect(answer).toContain('Hola, Marta.');
    expect(answer).toContain('*Encuadre*:');
    expect(answer).toMatch(/se establece encuadre\. \[1\]/);
    // Sección de fuentes con la nota numerada.
    expect(answer).toContain('**Fuentes**');
    expect(answer).toContain('[1] Nota del 12 de junio de 2026 — Encuadre');
    // Sección de huecos honesta.
    expect(answer).toContain('**Lo que no consta en el expediente**');
    expect(answer).toContain('No hay un diagnóstico CIE-11 registrado.');

    // El parseo de la UI reconstruye fuentes y huecos.
    const parsed = parseAssistantMessage(answer);
    expect(parsed.sources).toEqual(['Nota del 12 de junio de 2026 — Encuadre']);
    expect(parsed.gaps).toContain('No hay un diagnóstico CIE-11 registrado.');
  });

  it('sin contexto (paciente no identificado) no inventa fuentes', async () => {
    const engine = new LocalAssistantEngine('');
    const answer = await engine.answer('¿Qué notas tengo?', null);
    const parsed = parseAssistantMessage(answer);
    expect(parsed.sources).toEqual([]);
    expect(parsed.gaps).toEqual([]);
  });
});
