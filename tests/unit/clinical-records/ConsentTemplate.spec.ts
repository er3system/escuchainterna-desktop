import { describe, expect, it } from 'vitest';
import { ConsentTemplate } from '@/contexts/clinical-records/domain/ConsentTemplate';
import { InvalidConsentTemplateError } from '@/contexts/clinical-records/domain/errors/InvalidConsentTemplateError';
import {
  DEFAULT_CONSENT_BODY,
  resolveConsentVariables,
} from '@/contexts/clinical-records/domain/value-objects/defaultConsentBody';

describe('ConsentTemplate', () => {
  it('la plantilla por defecto trae el texto base con todas las variables', () => {
    const primitives = ConsentTemplate.createDefault('tpl-1').toPrimitives();
    expect(primitives.body).toBe(DEFAULT_CONSENT_BODY);
    for (const variable of ['{{paciente}}', '{{profesional}}', '{{cedula}}', '{{fecha}}']) {
      expect(primitives.body).toContain(variable);
    }
  });

  it('editar exige título y un cuerpo con longitud de documento', () => {
    const template = ConsentTemplate.createDefault('tpl-1');
    expect(() => template.edit({ title: '', body: DEFAULT_CONSENT_BODY })).toThrow(
      InvalidConsentTemplateError,
    );
    expect(() => template.edit({ title: 'Título', body: 'muy corto' })).toThrow(
      InvalidConsentTemplateError,
    );
    template.edit({ title: 'Mi consentimiento', body: 'x'.repeat(250) });
    expect(template.toPrimitives().title).toBe('Mi consentimiento');
  });
});

describe('resolveConsentVariables', () => {
  it('reemplaza solo las variables provistas y tolera espacios', () => {
    const body = 'Yo, {{ paciente }}, atendido por {{profesional}} ({{cedula}}), firmo el {{fecha}}.';
    const resolved = resolveConsentVariables(body, {
      paciente: 'Ana López',
      profesional: 'Dr. Juan Pérez',
      cedula: '12345678',
    });
    expect(resolved).toBe('Yo, Ana López, atendido por Dr. Juan Pérez (12345678), firmo el {{fecha}}.');
    expect(resolveConsentVariables(resolved, { fecha: '12 de junio de 2026' })).toContain(
      'firmo el 12 de junio de 2026.',
    );
  });
});
