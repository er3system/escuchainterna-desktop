import { MessageTemplate } from '../../domain/value-objects/MessageTemplate';
import { EmptyCampaignContentError } from '../../domain/errors/EmptyCampaignContentError';

export class SendMassEmailMessage {
  private readonly subject: MessageTemplate;
  private readonly body: MessageTemplate;
  private readonly recipientIds: string[] | 'todos';
  private readonly sender: { name: string; scheduleLink: string };

  public constructor(input: {
    subject: string;
    body: string;
    recipientIds: string[] | 'todos';
    senderName: string;
    scheduleLink: string;
  }) {
    this.subject = new MessageTemplate(input.subject.trim());
    this.body = new MessageTemplate(input.body.trim());
    if (this.subject.isEmpty() || this.body.isEmpty()) {
      throw new EmptyCampaignContentError();
    }
    this.recipientIds = input.recipientIds === 'todos' ? 'todos' : [...input.recipientIds];
    this.sender = { name: input.senderName, scheduleLink: input.scheduleLink };
  }

  public isForAllRecipients(): boolean {
    return this.recipientIds === 'todos';
  }

  public recipientIdList(): string[] {
    return this.recipientIds === 'todos' ? [] : [...this.recipientIds];
  }

  public subjectTemplate(): MessageTemplate {
    return this.subject;
  }

  public bodyTemplate(): MessageTemplate {
    return this.body;
  }

  public senderName(): string {
    return this.sender.name;
  }

  public scheduleLink(): string {
    return this.sender.scheduleLink;
  }
}
