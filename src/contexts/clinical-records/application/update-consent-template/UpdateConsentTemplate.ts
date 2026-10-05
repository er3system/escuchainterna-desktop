import { randomUUID } from 'node:crypto';
import { ConsentTemplate } from '../../domain/ConsentTemplate';
import type { ConsentTemplateRepository } from '../../domain/repositories/ConsentTemplateRepository';
import type { UpdateConsentTemplateMessage } from './UpdateConsentTemplateMessage';

export class UpdateConsentTemplate {
  public constructor(private readonly templates: ConsentTemplateRepository) {}

  public async execute(message: UpdateConsentTemplateMessage): Promise<void> {
    const template = (await this.templates.find()) ?? ConsentTemplate.createDefault(randomUUID());
    template.edit({ title: message.title(), body: message.body() });
    await this.templates.save(template);
  }
}
