import { AutomationKind } from '../../domain/MarketingAutomation';
import { UnknownAutomationKindError } from '../../domain/errors/UnknownAutomationKindError';

export class UpdateAutomationMessage {
  private readonly automationKind: AutomationKind;
  private readonly enabledFlag: boolean;
  private readonly subjectText: string;
  private readonly bodyText: string;
  private readonly months: number | null;

  public constructor(input: {
    kind: string;
    enabled: boolean;
    subject: string;
    body: string;
    intervalMonths?: number | null;
  }) {
    if (input.kind !== 'cumpleanios' && input.kind !== 'reactivacion') {
      throw new UnknownAutomationKindError(input.kind);
    }
    this.automationKind = input.kind;
    this.enabledFlag = input.enabled;
    this.subjectText = input.subject;
    this.bodyText = input.body;
    this.months =
      input.intervalMonths === undefined || input.intervalMonths === null || Number.isNaN(input.intervalMonths)
        ? null
        : input.intervalMonths;
  }

  public kind(): AutomationKind {
    return this.automationKind;
  }

  public configuration(): { enabled: boolean; subject: string; body: string; intervalMonths: number | null } {
    return {
      enabled: this.enabledFlag,
      subject: this.subjectText,
      body: this.bodyText,
      intervalMonths: this.months,
    };
  }
}
