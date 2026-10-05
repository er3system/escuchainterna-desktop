import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { InvalidConsentTemplateError } from './errors/InvalidConsentTemplateError';
import { DEFAULT_CONSENT_BODY, DEFAULT_CONSENT_TITLE } from './value-objects/defaultConsentBody';

export interface ConsentTemplatePrimitives {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
}

/**
 * Plantilla de consentimiento informado del profesional (1 por owner, v3 §2).
 * El cuerpo admite las variables {{paciente}}, {{profesional}}, {{cedula}} y
 * {{fecha}}; al emitir un consentimiento se congela un snapshot del texto.
 */
export class ConsentTemplate extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private title: string,
    private body: string,
    private updatedAt: Date,
  ) {
    super();
  }

  /** Primera vez: plantilla con el texto base serio (telepsicología, confidencialidad, datos, voluntariedad). */
  public static createDefault(id: string): ConsentTemplate {
    return new ConsentTemplate(id, DEFAULT_CONSENT_TITLE, DEFAULT_CONSENT_BODY, new Date());
  }

  public static fromPrimitives(primitives: ConsentTemplatePrimitives): ConsentTemplate {
    return new ConsentTemplate(
      primitives.id,
      primitives.title,
      primitives.body,
      new Date(primitives.updatedAt),
    );
  }

  public edit(input: { title: string; body: string }): void {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title === '' || body === '') throw new InvalidConsentTemplateError();
    if (body.length < 200) {
      throw new InvalidConsentTemplateError(
        'El texto del consentimiento es demasiado corto para ser un documento válido (mínimo 200 caracteres).',
      );
    }
    this.title = title;
    this.body = body;
    this.updatedAt = new Date();
  }

  public toPrimitives(): ConsentTemplatePrimitives {
    return {
      id: this.id,
      title: this.title,
      body: this.body,
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
