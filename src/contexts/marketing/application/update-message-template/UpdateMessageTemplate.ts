import { MessageTemplateOverrideRepository } from '../../domain/repositories/MessageTemplateOverrideRepository';
import { UpdateMessageTemplateMessage } from './UpdateMessageTemplateMessage';

/**
 * Personaliza el CONTENIDO de una plantilla integrada (asunto y cuerpo).
 * La clave y el nombre son fijos: nunca se renombra.
 */
export class UpdateMessageTemplate {
  public constructor(private readonly overrides: MessageTemplateOverrideRepository) {}

  public async update(message: UpdateMessageTemplateMessage): Promise<void> {
    const definition = message.templateDefinition();
    await this.overrides.save({
      templateKey: definition.key,
      name: definition.name,
      channel: definition.channel,
      subject: message.subjectText(),
      body: message.bodyText(),
    });
  }
}
