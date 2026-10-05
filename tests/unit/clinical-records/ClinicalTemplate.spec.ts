import { describe, expect, it } from 'vitest';
import { ClinicalTemplate, parseTemplateSections } from '@/contexts/clinical-records/domain/ClinicalTemplate';
import { BuiltinTemplateIsReadOnlyError } from '@/contexts/clinical-records/domain/errors/BuiltinTemplateIsReadOnlyError';
import { InvalidTemplateSectionsError } from '@/contexts/clinical-records/domain/errors/InvalidTemplateSectionsError';

describe('parseTemplateSections', () => {
  it('normaliza secciones válidas y genera ids faltantes', () => {
    const sections = parseTemplateSections([
      {
        title: 'Motivo',
        fields: [
          { label: 'Motivo de consulta', type: 'texto_largo', required: true },
          { label: 'Intensidad', type: 'escala', scaleMin: 1, scaleMax: 10 },
        ],
      },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBeTruthy();
    expect(sections[0].fields[0].id).toBeTruthy();
    expect(sections[0].fields[0].required).toBe(true);
    expect(sections[0].fields[1].scaleMax).toBe(10);
  });

  it('conserva los ids existentes (estabilidad de respuestas)', () => {
    const sections = parseTemplateSections([
      { id: 'mi-seccion', title: 'X', fields: [{ id: 'mi-campo', label: 'P', type: 'texto_corto' }] },
    ]);
    expect(sections[0].id).toBe('mi-seccion');
    expect(sections[0].fields[0].id).toBe('mi-campo');
  });

  it('rechaza plantillas sin secciones con contenido', () => {
    expect(() => parseTemplateSections([])).toThrow(InvalidTemplateSectionsError);
    expect(() => parseTemplateSections([{ title: 'Vacía', fields: [] }])).toThrow(InvalidTemplateSectionsError);
  });

  it('exige opciones en campos de selección', () => {
    expect(() =>
      parseTemplateSections([
        { title: 'S', fields: [{ label: 'Elige', type: 'seleccion', options: [] }] },
      ]),
    ).toThrow(InvalidTemplateSectionsError);
  });

  it('rechaza escalas invertidas', () => {
    expect(() =>
      parseTemplateSections([
        { title: 'S', fields: [{ label: 'E', type: 'escala', scaleMin: 5, scaleMax: 2 }] },
      ]),
    ).toThrow(InvalidTemplateSectionsError);
  });
});

describe('ClinicalTemplate', () => {
  it('las integradas son de solo lectura', () => {
    const builtin = ClinicalTemplate.fromPrimitives({
      id: 'builtin-x',
      name: 'Integrada',
      therapyType: '',
      description: '',
      sections: [{ id: 's', title: 'S', fields: [{ id: 'f', label: 'F', type: 'texto_corto' }] }],
      isBuiltin: true,
      createdAt: new Date().toISOString(),
    });
    expect(() => builtin.ensureEditable()).toThrow(BuiltinTemplateIsReadOnlyError);
    expect(() =>
      builtin.update({ name: 'Otro', therapyType: '', description: '', sections: [] }),
    ).toThrow(BuiltinTemplateIsReadOnlyError);
  });

  it('las personalizadas se pueden actualizar', () => {
    const custom = ClinicalTemplate.createCustom({
      id: 'custom-1',
      name: 'Mía',
      therapyType: 'Gestalt',
      description: 'desc',
      sections: [{ id: 's', title: 'S', fields: [{ id: 'f', label: 'F', type: 'texto_corto' }] }],
    });
    custom.update({
      name: 'Mía v2',
      therapyType: 'Gestalt',
      description: 'desc 2',
      sections: [{ id: 's2', title: 'S2', fields: [{ id: 'f2', label: 'F2', type: 'fecha' }] }],
    });
    const primitives = custom.toPrimitives();
    expect(primitives.name).toBe('Mía v2');
    expect(primitives.sections[0].id).toBe('s2');
    expect(primitives.isBuiltin).toBe(false);
  });
});
