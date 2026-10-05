export interface TemplateVariables {
  nombre: string;
  profesional: string;
  ligaAgenda: string;
}

/**
 * Plantilla de mensaje de marketing con variables {{nombre}}, {{profesional}}
 * y {{liga_agenda}}. La sustitución ocurre una sola vez, aquí.
 */
export class MessageTemplate {
  public constructor(private readonly text: string) {}

  public render(variables: TemplateVariables): string {
    return this.text
      .replaceAll('{{nombre}}', variables.nombre)
      .replaceAll('{{profesional}}', variables.profesional)
      .replaceAll('{{liga_agenda}}', variables.ligaAgenda);
  }

  public isEmpty(): boolean {
    return this.text.trim().length === 0;
  }

  public toString(): string {
    return this.text;
  }
}
