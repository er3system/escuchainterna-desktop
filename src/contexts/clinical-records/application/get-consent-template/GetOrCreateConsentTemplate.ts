import { randomUUID } from 'node:crypto';
import { ConsentTemplate, type ConsentTemplatePrimitives } from '../../domain/ConsentTemplate';
import type { ConsentTemplateRepository } from '../../domain/repositories/ConsentTemplateRepository';

/**
 * Plantilla de consentimiento del profesional: al primer uso se crea con el
 * texto base serio (v3 §2) y a partir de ahí es editable.
 */
export class GetOrCreateConsentTemplate {
  public constructor(private readonly templates: ConsentTemplateRepository) {}

  public async execute(): Promise<ConsentTemplatePrimitives> {
    const existing = await this.templates.find();
    if (existing) return existing.toPrimitives();

    const template = ConsentTemplate.createDefault(randomUUID());
    await this.templates.save(template);
    return template.toPrimitives();
  }
}
