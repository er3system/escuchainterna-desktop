import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import { TemplateNotFoundError } from '../../domain/errors/TemplateNotFoundError';
import type { UpdateCustomTemplateMessage } from './UpdateCustomTemplateMessage';

export class UpdateCustomTemplate {
  public constructor(private readonly templates: ClinicalTemplateRepository) {}

  public async execute(message: UpdateCustomTemplateMessage): Promise<void> {
    const template = await this.templates.findById(message.templateId());
    if (!template) throw new TemplateNotFoundError(message.templateId());
    template.update({
      name: message.name(),
      therapyType: message.therapyType(),
      description: message.description(),
      sections: message.sections(),
    });
    await this.templates.save(template);
  }
}
