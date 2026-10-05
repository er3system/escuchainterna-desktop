import { AggregateRoot } from '@/shared/domain/AggregateRoot';

export interface MarketingCampaignPrimitives {
  id: string;
  subject: string;
  body: string;
  audience: string[];
  sentAt: string | null;
}

export class MarketingCampaign extends AggregateRoot {
  private constructor(
    private readonly id: string,
    private readonly subject: string,
    private readonly body: string,
    private readonly audience: string[],
    private readonly sentAt: Date | null,
  ) {
    super();
  }

  /** Registra una campaña recién enviada al conjunto de pacientes indicado. */
  public static send(subject: string, body: string, audiencePatientIds: string[]): MarketingCampaign {
    return new MarketingCampaign(
      globalThis.crypto.randomUUID(),
      subject,
      body,
      [...audiencePatientIds],
      new Date(),
    );
  }

  public static fromPrimitives(primitives: MarketingCampaignPrimitives): MarketingCampaign {
    return new MarketingCampaign(
      primitives.id,
      primitives.subject,
      primitives.body,
      [...primitives.audience],
      primitives.sentAt ? new Date(primitives.sentAt) : null,
    );
  }

  public toPrimitives(): MarketingCampaignPrimitives {
    return {
      id: this.id,
      subject: this.subject,
      body: this.body,
      audience: [...this.audience],
      sentAt: this.sentAt ? this.sentAt.toISOString() : null,
    };
  }
}
