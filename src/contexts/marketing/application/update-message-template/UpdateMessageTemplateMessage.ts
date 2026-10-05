import { findTemplateDefinition, MessageTemplateDefinition } from '../../domain/value-objects/messageTemplateCatalog';
import { EmptyTemplateContentError } from '../../domain/errors/EmptyTemplateContentError';
import { UnknownTemplateKeyError } from '../../domain/errors/UnknownTemplateKeyError';

export class UpdateMessageTemplateMessage {
  private readonly definition: MessageTemplateDefinition;
  private readonly subject: string;
  private readonly body: string;

  public constructor(input: { templateKey: string; subject: string; body: string }) {
    const definition = findTemplateDefinition(input.templateKey.trim());
    if (!definition) throw new UnknownTemplateKeyError(input.templateKey);
    const body = input.body.trim();
    if (body === '') throw new EmptyTemplateContentError();
    this.definition = definition;
    this.subject = input.subject.trim();
    this.body = body;
  }

  public templateDefinition(): MessageTemplateDefinition {
    return this.definition;
  }

  public subjectText(): string {
    return this.subject;
  }

  public bodyText(): string {
    return this.body;
  }
}
