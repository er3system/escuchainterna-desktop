import { describe, it, expect } from 'vitest';
import {
  HISTORIA_DEFAULT_TEMPLATE_KEY,
  normalizeDefaultTemplateId,
} from '@/contexts/clinical-records/domain/clinicalPreferences';

describe('clinicalPreferences — plantilla por defecto (expediente v2 §3)', () => {
  it('la clave de preferencia es estable', () => {
    expect(HISTORIA_DEFAULT_TEMPLATE_KEY).toBe('historia_default_template');
  });

  it('normaliza vacíos a null y recorta el id', () => {
    expect(normalizeDefaultTemplateId(null)).toBeNull();
    expect(normalizeDefaultTemplateId(undefined)).toBeNull();
    expect(normalizeDefaultTemplateId('')).toBeNull();
    expect(normalizeDefaultTemplateId('   ')).toBeNull();
    expect(normalizeDefaultTemplateId('  builtin-tcc ')).toBe('builtin-tcc');
  });
});
