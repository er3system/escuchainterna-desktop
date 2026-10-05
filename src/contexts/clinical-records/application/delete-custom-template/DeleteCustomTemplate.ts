import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';
import { TemplateNotFoundError } from '../../domain/errors/TemplateNotFoundError';

export class DeleteCustomTemplate {
  public constructor(private readonly templates: ClinicalTemplateRepository) {}

  public async execute(templateId: string): Promise<void> {
    const template = await this.templates.findById(templateId);
    if (!template) throw new TemplateNotFoundError(templateId);
    template.ensureEditable();
    await this.templates.delete(templateId);
  }
}
