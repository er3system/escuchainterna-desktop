import type { ClinicalTemplatePrimitives } from '../../domain/ClinicalTemplate';
import type { ClinicalTemplateRepository } from '../../domain/repositories/ClinicalTemplateRepository';

export class ListTemplates {
  public constructor(private readonly templates: ClinicalTemplateRepository) {}

  /** Integradas primero, después propias; ambas por nombre. */
  public async execute(): Promise<ClinicalTemplatePrimitives[]> {
    const all = await this.templates.listAll();
    return all
      .map((template) => template.toPrimitives())
      .sort((a, b) => {
        if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1;
        return a.name.localeCompare(b.name, 'es');
      });
  }
}
