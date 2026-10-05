import { randomUUID } from 'node:crypto';
import { ClinicalTemplate } from '../../domain/ClinicalTemplate';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import type { CreateCustomTemplateMessage } from './CreateCustomTemplateMessage';

export class CreateCustomTemplate {
  public constructor(private readonly templates: ClinicalTemplateRepository) {}

  public async execute(message: CreateCustomTemplateMessage): Promise<string> {
    const template = ClinicalTemplate.createCustom({
      id: randomUUID(),
      name: message.name(),
      therapyType: message.therapyType(),
      description: message.description(),
      sections: message.sections(),
    });
    await this.templates.save(template);
    return template.templateId();
  }
}
