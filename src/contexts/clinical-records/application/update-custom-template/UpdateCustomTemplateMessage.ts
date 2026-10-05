import type { ClinicalSection } from '@/shared/infrastructure/persistence/builtinTemplates';
import { parseTemplateSections } from '../../domain/ClinicalTemplate';

export class UpdateCustomTemplateMessage {
  private readonly templateIdValue: string;
  private readonly nameValue: string;
  private readonly therapyTypeValue: string;
  private readonly descriptionValue: string;
  private readonly sectionsValue: ClinicalSection[];

  public constructor(input: {
    templateId: string;
    name: string;
    therapyType: string;
    description: string;
    sections: unknown;
  }) {
    if (!input.templateId) throw new Error('Falta la plantilla a actualizar.');
    const name = input.name?.trim() ?? '';
    if (!name) throw new Error('La plantilla necesita un nombre.');
    this.templateIdValue = input.templateId;
    this.nameValue = name;
    this.therapyTypeValue = input.therapyType?.trim() ?? '';
    this.descriptionValue = input.description?.trim() ?? '';
    this.sectionsValue = parseTemplateSections(input.sections);
  }

  public templateId(): string {
    return this.templateIdValue;
  }

  public name(): string {
    return this.nameValue;
  }

  public therapyType(): string {
    return this.therapyTypeValue;
  }

  public description(): string {
    return this.descriptionValue;
  }

  public sections(): ClinicalSection[] {
    return this.sectionsValue;
  }
}
