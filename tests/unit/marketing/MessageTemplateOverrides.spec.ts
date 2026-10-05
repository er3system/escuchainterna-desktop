import { describe, expect, it } from 'vitest';
import { GetEffectiveTemplates } from '@/contexts/marketing/application/get-effective-templates/GetEffectiveTemplates';
import { RestoreMessageTemplate } from '@/contexts/marketing/application/restore-message-template/RestoreMessageTemplate';
import { UpdateMessageTemplate } from '@/contexts/marketing/application/update-message-template/UpdateMessageTemplate';
import { UpdateMessageTemplateMessage } from '@/contexts/marketing/application/update-message-template/UpdateMessageTemplateMessage';
import { EmptyTemplateContentError } from '@/contexts/marketing/domain/errors/EmptyTemplateContentError';
import { UnknownTemplateKeyError } from '@/contexts/marketing/domain/errors/UnknownTemplateKeyError';
import {
  MessageTemplateOverride,
  MessageTemplateOverrideRepository,
} from '@/contexts/marketing/domain/repositories/MessageTemplateOverrideRepository';
import {
  MESSAGE_TEMPLATE_CATALOG,
  findTemplateDefinition,
  renderTemplateContent,
} from '@/contexts/marketing/domain/value-objects/messageTemplateCatalog';

class InMemoryOverrides implements MessageTemplateOverrideRepository {
  private readonly rows = new Map<string, MessageTemplateOverride>();

  public async findByKey(templateKey: string): Promise<MessageTemplateOverride | null> {
    return this.rows.get(templateKey) ?? null;
  }

  public async listAll(): Promise<MessageTemplateOverride[]> {
    return [...this.rows.values()];
  }

  public async save(input: {
    templateKey: string;
    name: string;
    channel: string;
    subject: string;
    body: string;
  }): Promise<void> {
    this.rows.set(input.templateKey, {
      templateKey: input.templateKey,
      subject: input.subject,
      body: input.body,
      updatedAt: new Date().toISOString(),
    });
  }

  public async deleteByKey(templateKey: string): Promise<void> {
    this.rows.delete(templateKey);
  }
}

describe('catálogo de plantillas integradas', () => {
  it('incluye las ~10 plantillas de marketing del menú desplegable (spec 6.6)', () => {
    const marketingKeys = MESSAGE_TEMPLATE_CATALOG.filter((template) => template.kind === 'marketing').map(
      (template) => template.key,
    );
    expect(marketingKeys).toEqual([
      'fidelizacion',
      'ejercicio_complementario',
      'reconexion',
      'bienvenida',
      'seguimiento_post_alta',
      'referidos',
      'fechas_especiales',
      'encuesta_satisfaccion',
      'taller_grupo',
      'cambio_horarios',
    ]);
  });

  it('renderTemplateContent sustituye tokens y limpia saltos sobrantes', () => {
    const rendered = renderTemplateContent('Hola {{nombre}},\n\n\n{{politicas}}\n\nSaludos, {{profesional}}', {
      nombre: 'María',
      politicas: '',
      profesional: 'Ana',
    });
    expect(rendered).toBe('Hola María,\n\nSaludos, Ana');
  });
});

describe('GetEffectiveTemplates', () => {
  it('devuelve las integradas cuando el profesional no ha personalizado nada', async () => {
    const templates = await new GetEffectiveTemplates(new InMemoryOverrides()).get();
    expect(templates).toHaveLength(MESSAGE_TEMPLATE_CATALOG.length);
    expect(templates.every((template) => !template.isCustomized)).toBe(true);
  });

  it('aplica la personalización del owner encima de la integrada', async () => {
    const overrides = new InMemoryOverrides();
    await new UpdateMessageTemplate(overrides).update(
      new UpdateMessageTemplateMessage({
        templateKey: 'recordatorio_sesion',
        subject: 'No olvides tu sesión',
        body: 'Hola {{nombre}}, nos vemos el {{fecha}} a las {{hora}}.',
      }),
    );

    const templates = await new GetEffectiveTemplates(overrides).get();
    const custom = templates.find((template) => template.key === 'recordatorio_sesion');
    expect(custom?.isCustomized).toBe(true);
    expect(custom?.subject).toBe('No olvides tu sesión');
    expect(custom?.body).toContain('nos vemos el {{fecha}}');
    // El nombre es fijo: nunca cambia aunque se personalice el contenido.
    expect(custom?.name).toBe(findTemplateDefinition('recordatorio_sesion')?.name);

    const untouched = templates.find((template) => template.key === 'sesion_agendada');
    expect(untouched?.isCustomized).toBe(false);
  });
});

describe('UpdateMessageTemplate', () => {
  it('rechaza claves que no existen en el catálogo', () => {
    expect(
      () => new UpdateMessageTemplateMessage({ templateKey: 'inventada', subject: '', body: 'Hola' }),
    ).toThrow(UnknownTemplateKeyError);
  });

  it('rechaza contenido vacío', () => {
    expect(
      () => new UpdateMessageTemplateMessage({ templateKey: 'cumpleanios', subject: 'Feliz día', body: '   ' }),
    ).toThrow(EmptyTemplateContentError);
  });
});

describe('RestoreMessageTemplate', () => {
  it('borra la personalización y vuelve al contenido integrado', async () => {
    const overrides = new InMemoryOverrides();
    await new UpdateMessageTemplate(overrides).update(
      new UpdateMessageTemplateMessage({ templateKey: 'cumpleanios', subject: 'Feliz', body: 'Hola {{nombre}}' }),
    );
    expect(await overrides.findByKey('cumpleanios')).not.toBeNull();

    await new RestoreMessageTemplate(overrides).restore('cumpleanios');
    expect(await overrides.findByKey('cumpleanios')).toBeNull();

    const restored = (await new GetEffectiveTemplates(overrides).get()).find(
      (template) => template.key === 'cumpleanios',
    );
    expect(restored?.isCustomized).toBe(false);
    expect(restored?.body).toBe(findTemplateDefinition('cumpleanios')?.body);
  });

  it('rechaza claves desconocidas', async () => {
    await expect(new RestoreMessageTemplate(new InMemoryOverrides()).restore('nope')).rejects.toThrow(
      UnknownTemplateKeyError,
    );
  });
});
