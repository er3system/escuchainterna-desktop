import { describe, it, expect } from 'vitest';
import { renderClinicalMarkdownToHtml } from '@/contexts/clinical-records/domain/clinicalMarkdown';
import { buildCaseMemberReportMarkdown } from '@/contexts/clinical-records/domain/caseReportContent';

describe('renderClinicalMarkdownToHtml (vista previa formateada, no markdown crudo)', () => {
  it('renderiza encabezados, listas, negritas y citas', () => {
    const html = renderClinicalMarkdownToHtml(
      '# Título\n\n## Sección\n- punto uno\n- **clave:** valor\n\n> nota\n\nPárrafo final.',
    );
    expect(html).toContain('<h1>Título</h1>');
    expect(html).toContain('<h2>Sección</h2>');
    expect(html).toContain('<li>punto uno</li>');
    expect(html).toContain('<strong>clave:</strong>');
    expect(html).toContain('<blockquote>nota</blockquote>');
    expect(html).toContain('<p>Párrafo final.</p>');
    // No deja el marcado crudo suelto.
    expect(html).not.toContain('## Sección');
  });

  it('escapa el HTML del contenido del usuario (seguro para dangerouslySetInnerHTML)', () => {
    const html = renderClinicalMarkdownToHtml('Riesgo <script>alert(1)</script> & "comillas"');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&amp;');
  });
});

describe('buildCaseMemberReportMarkdown · perfil del sistema', () => {
  const base = {
    caseTitle: 'Familia Pérez',
    memberName: 'Ana',
    secretsPolicy: 'no_secretos',
    generatedAt: '2026-06-18T10:00:00.000Z',
    jointSessions: [],
    individualSessions: [],
  };

  it('incluye evaluación del sistema, objetivos, línea de tiempo y mapa de relaciones', () => {
    const md = buildCaseMemberReportMarkdown({
      ...base,
      systemEval: {
        lifeCycleStage: 'Hijos adolescentes',
        structure: 'Coalición madre-hijo',
        communication: '',
        systemMotive: 'Conflictos por límites',
      },
      objectives: 'Recuperar la jerarquía parental',
      events: [{ date: '2019', title: 'Separación', note: '' }],
      relations: [{ a: 'Ana', b: 'Luis', quality: 'conflictivo', note: 'roces diarios' }],
    });
    expect(md).toContain('## Evaluación del sistema');
    expect(md).toContain('**Etapa del ciclo vital familiar:** Hijos adolescentes');
    // El campo vacío (comunicación) NO aparece.
    expect(md).not.toContain('Patrones de comunicación');
    expect(md).toContain('## Objetivos del caso');
    expect(md).toContain('Recuperar la jerarquía parental');
    expect(md).toContain('## Línea de tiempo del sistema');
    expect(md).toContain('2019 — Separación');
    expect(md).toContain('## Mapa de relaciones');
    expect(md).toContain('**Ana ↔ Luis:** Conflictivo — roces diarios');
  });

  it('omite por completo el perfil cuando está vacío', () => {
    const md = buildCaseMemberReportMarkdown(base);
    expect(md).not.toContain('## Evaluación del sistema');
    expect(md).not.toContain('## Objetivos del caso');
    expect(md).not.toContain('## Mapa de relaciones');
    // Las secciones de sesiones sí están siempre.
    expect(md).toContain('## Sesiones conjuntas (compartidas)');
    expect(md).toContain('## Sesiones individuales de Ana');
  });
});
