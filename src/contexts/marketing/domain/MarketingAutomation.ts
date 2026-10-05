import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { MessageTemplate, TemplateVariables } from './value-objects/MessageTemplate';
import { findTemplateDefinition } from './value-objects/messageTemplateCatalog';
import { EmptyAutomationContentError } from './errors/EmptyAutomationContentError';
import { UnknownAutomationKindError } from './errors/UnknownAutomationKindError';

export type AutomationKind = 'cumpleanios' | 'reactivacion';

export const MARKETING_AUTOMATION_KINDS: ReadonlyArray<AutomationKind> = [
  'cumpleanios',
  'reactivacion',
];

export interface MarketingAutomationPrimitives {
  id: string;
  kind: AutomationKind;
  enabled: boolean;
  intervalMonths: number | null;
  subject: string;
  body: string;
}

export interface RenderedAutomationEmail {
  subject: string;
  body: string;
}

export class MarketingAutomation extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly kind: AutomationKind,
    private enabled: boolean,
    private intervalMonths: number | null,
    private subject: string,
    private body: string,
  ) {
    super();
  }

  public static fromPrimitives(primitives: MarketingAutomationPrimitives): MarketingAutomation {
    return new MarketingAutomation(
      primitives.id,
      primitives.kind,
      primitives.enabled,
      primitives.intervalMonths,
      primitives.subject,
      primitives.body,
    );
  }

  /**
   * Configuración integrada para un propietario que todavía no ha personalizado
   * esta automatización. Los defaults nacen desactivados: habilitarlos siempre es
   * una decisión explícita del profesional.
   */
  public static defaultFor(id: string, kind: AutomationKind): MarketingAutomation {
    const template = findTemplateDefinition(kind);
    if (!template) throw new UnknownAutomationKindError(kind);
    return new MarketingAutomation(
      id,
      kind,
      false,
      kind === 'reactivacion' ? 6 : null,
      template.subject,
      template.body,
    );
  }

  public configure(input: {
    enabled: boolean;
    subject: string;
    body: string;
    intervalMonths?: number | null;
  }): void {
    const subject = new MessageTemplate(input.subject);
    const body = new MessageTemplate(input.body);
    if (input.enabled && (subject.isEmpty() || body.isEmpty())) {
      throw new EmptyAutomationContentError();
    }
    this.enabled = input.enabled;
    this.subject = input.subject.trim();
    this.body = input.body.trim();
    if (this.kind === 'reactivacion') {
      const months = input.intervalMonths ?? this.intervalMonths ?? 6;
      this.intervalMonths = Math.min(24, Math.max(1, Math.round(months)));
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public reactivationMonths(): number {
    return this.intervalMonths ?? 6;
  }

  public renderFor(variables: TemplateVariables): RenderedAutomationEmail {
    return {
      subject: new MessageTemplate(this.subject).render(variables),
      body: new MessageTemplate(this.body).render(variables),
    };
  }

  public toPrimitives(): MarketingAutomationPrimitives {
    return {
      id: this.id,
      kind: this.kind,
      enabled: this.enabled,
      intervalMonths: this.intervalMonths,
      subject: this.subject,
      body: this.body,
    };
  }
}
