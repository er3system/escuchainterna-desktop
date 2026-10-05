import { describe, it, expect } from 'vitest';
import { migrateRecordSections } from '@/contexts/clinical-records/domain/historiaBlocks';
import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';

describe('migrateRecordSections — migración de ids de bloques recurados (§10)', () => {
  it('remapea id de sección, de campos y claves de respuesta sin perder datos', () => {
    const oldId = 'builtin-tcc:analisis-funcional';
    const sections: ClinicalSection[] = [
      {
        id: oldId,
        title: 'Análisis funcional (A-B-C)',
        fields: [
          { id: `${oldId}::antecedentes-situacionales`, label: 'Antecedentes', type: 'texto_largo' },
          { id: `${oldId}::consecuencias`, label: 'Consecuencias', type: 'texto_largo' },
        ],
      },
    ];
    const answers = {
      [`${oldId}::antecedentes-situacionales`]: 'Discusión con su jefe',
      [`${oldId}::consecuencias`]: 'Evita la oficina',
    };

    const result = migrateRecordSections(sections, answers);
    const newId = 'bloque:analisis-funcional-abc';

    expect(result.sections?.[0].id).toBe(newId);
    expect(result.sections?.[0].fields[0].id).toBe(`${newId}::antecedentes-situacionales`);
    // El contenido se conserva bajo la nueva clave.
    expect(result.answers[`${newId}::antecedentes-situacionales`]).toBe('Discusión con su jefe');
    expect(result.answers[`${newId}::consecuencias`]).toBe('Evita la oficina');
    // No quedan claves antiguas.
    expect(result.answers[`${oldId}::antecedentes-situacionales`]).toBeUndefined();
  });

  it('deja intactas las secciones sin mapeo (núcleo y bloques ya curados)', () => {
    const sections: ClinicalSection[] = [
      { id: 'identificacion', title: 'Ficha de identificación', fields: [{ id: 'ocupacion', label: 'Ocupación', type: 'texto_corto' }] },
      { id: 'bloque:examen-mental', title: 'Examen mental', fields: [{ id: 'bloque:examen-mental::apariencia-actitud', label: 'Apariencia', type: 'texto_largo' }] },
    ];
    const answers = { ocupacion: 'Docente' };
    const result = migrateRecordSections(sections, answers);
    // Sin cambios: misma referencia de secciones y respuestas.
    expect(result.sections).toBe(sections);
    expect(result.answers).toBe(answers);
  });

  it('tolera secciones nulas o vacías', () => {
    expect(migrateRecordSections(null, {}).sections).toBeNull();
    expect(migrateRecordSections([], {}).sections).toEqual([]);
  });
});
