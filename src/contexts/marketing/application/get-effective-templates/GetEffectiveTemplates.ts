import {
  MESSAGE_TEMPLATE_CATALOG,
  MessageTemplateChannel,
  MessageTemplateKind,
} from '../../domain/value-objects/messageTemplateCatalog';
import { MessageTemplateOverrideRepository } from '../../domain/repositories/MessageTemplateOverrideRepository';

/** Plantilla integrada con la personalización del profesional aplicada. */
export interface EffectiveMessageTemplate {
  key: string;
  name: string;
  kind: MessageTemplateKind;
  channel: MessageTemplateChannel;
  description: string;
  subject: string;
  body: string;
  variables: string[];
  /** true si el contenido viene de message_templates (fila propia del owner). */
  isCustomized: boolean;
}

/**
 * Lista unificada de TODAS las plantillas de mensajes (notificaciones,
 * automatizaciones y marketing): la integrada del catálogo con el contenido
 * personalizado del profesional encima, si existe.
 */
export class GetEffectiveTemplates {
  public constructor(private readonly overrides: MessageTemplateOverrideRepository) {}

  public async get(): Promise<EffectiveMessageTemplate[]> {
    const overrides = await this.overrides.listAll();
    const customByKey = new Map(overrides.map((override) => [override.templateKey, override]));
    return MESSAGE_TEMPLATE_CATALOG.map((template) => {
      const custom = customByKey.get(template.key);
      return {
        key: template.key,
        name: template.name,
        kind: template.kind,
        channel: template.channel,
        description: template.description,
        subject: custom?.subject.trim() ? custom.subject : template.subject,
        body: custom ? custom.body : template.body,
        variables: [...template.variables],
        isCustomized: custom !== undefined,
      };
    });
  }
}
