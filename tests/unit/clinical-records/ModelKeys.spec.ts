import { describe, it, expect } from 'vitest';
import {
  MODEL_KEYS,
  MODEL_DESCRIPTORS,
  isModelKey,
  modelDescriptors,
  modelDescriptorForTemplateId,
} from '@/contexts/clinical-records/domain/modelKeys';
import { BUILTIN_CLINICAL_TEMPLATES } from '@/shared/infrastructure/persistence/builtinTemplates';

describe('modelKeys — vocabulario canónico de modelos (expediente v2 §3)', () => {
  it('hay 15 modelos con keys únicas, "general" primero y "libre" después', () => {
    expect(MODEL_KEYS).toHaveLength(15);
    expect(new Set(MODEL_KEYS).size).toBe(MODEL_KEYS.length);
    expect(MODEL_KEYS[0]).toBe('general');
    expect(MODEL_KEYS[1]).toBe('libre');
  });

  it('el modelo "libre" apunta a su plantilla de un solo campo de texto', () => {
    expect(MODEL_DESCRIPTORS.libre.builtinTemplateId).toBe('builtin-historia-libre');
    const template = BUILTIN_CLINICAL_TEMPLATES.find((t) => t.id === 'builtin-historia-libre');
    expect(template).toBeDefined();
    // Una sola sección de contenido (más la de "Notas adicionales" que añade el catálogo).
    const contentSections = template!.sections.filter((s) => s.id !== 'notas-adicionales');
    expect(contentSections).toHaveLength(1);
    expect(contentSections[0].fields).toHaveLength(1);
    expect(contentSections[0].fields[0].type).toBe('texto_largo');
  });

  it('cada descriptor coincide con su key y trae metadatos no vacíos', () => {
    for (const key of MODEL_KEYS) {
      const descriptor = MODEL_DESCRIPTORS[key];
      expect(descriptor.key).toBe(key);
      expect(descriptor.name.trim()).not.toBe('');
      expect(descriptor.enfoque.trim()).not.toBe('');
      expect(descriptor.whenToUse.trim()).not.toBe('');
      expect(descriptor.preview.trim()).not.toBe('');
    }
  });

  it('toda plantilla integrada referenciada existe en builtinTemplates', () => {
    const ids = new Set(BUILTIN_CLINICAL_TEMPLATES.map((t) => t.id));
    for (const descriptor of modelDescriptors()) {
      if (descriptor.builtinTemplateId) {
        expect(ids.has(descriptor.builtinTemplateId)).toBe(true);
      }
    }
  });

  it('los 14 modelos ya tienen plantilla integrada, con ids únicos (Fase 2)', () => {
    const ids = modelDescriptors().map((d) => d.builtinTemplateId);
    expect(ids.every((id) => typeof id === 'string' && id !== null)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los 7 modelos creados en Fase 2 apuntan a sus nuevas plantillas', () => {
    const pares: Array<[string, string]> = [
      ['trec', 'builtin-trec'],
      ['act', 'builtin-act'],
      ['activacion-conductual', 'builtin-activacion-conductual'],
      ['dbt', 'builtin-dbt'],
      ['humanista', 'builtin-humanista'],
      ['gestalt', 'builtin-gestalt'],
      ['breve-soluciones', 'builtin-breve-soluciones'],
    ];
    for (const [key, templateId] of pares) {
      expect(MODEL_DESCRIPTORS[key as keyof typeof MODEL_DESCRIPTORS].builtinTemplateId).toBe(templateId);
    }
  });

  it('isModelKey distingue keys válidas de inválidas', () => {
    expect(isModelKey('tcc')).toBe(true);
    expect(isModelKey('humanista')).toBe(true);
    // No existe el sinónimo largo: el vocabulario es unificado.
    expect(isModelKey('humanismo-centrado-persona')).toBe(false);
    expect(isModelKey('')).toBe(false);
    expect(isModelKey(42)).toBe(false);
  });

  it('mapea de plantilla integrada a su modelo y de vuelta', () => {
    expect(modelDescriptorForTemplateId('builtin-tcc')?.key).toBe('tcc');
    expect(modelDescriptorForTemplateId('builtin-familiar')?.key).toBe('sistemica-familiar');
    expect(modelDescriptorForTemplateId('builtin-pareja')?.key).toBe('parejas');
    expect(modelDescriptorForTemplateId(null)).toBeNull();
    expect(modelDescriptorForTemplateId('builtin-triaje')).toBeNull();
  });
});
