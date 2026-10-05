import { findTemplateDefinition } from '../../domain/value-objects/messageTemplateCatalog';
import { UnknownTemplateKeyError } from '../../domain/errors/UnknownTemplateKeyError';
import { MessageTemplateOverrideRepository } from '../../domain/repositories/MessageTemplateOverrideRepository';

/**
 * "Restaurar original": elimina la personalización del profesional para esa
 * clave; los notifiers vuelven a usar la plantilla integrada.
 */
export class RestoreMessageTemplate {
  public constructor(private readonly overrides: MessageTemplateOverrideRepository) {}

  public async restore(templateKey: string): Promise<void> {
    if (!findTemplateDefinition(templateKey.trim())) throw new UnknownTemplateKeyError(templateKey);
    await this.overrides.deleteByKey(templateKey.trim());
  }
}
