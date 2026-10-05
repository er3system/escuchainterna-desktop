import { InvalidConsentTemplateError } from '../../domain/errors/InvalidConsentTemplateError';

export class UpdateConsentTemplateMessage {
  private readonly titleValue: string;
  private readonly bodyValue: string;

  public constructor(input: { title: string; body: string }) {
    const title = (input.title ?? '').trim();
    const body = (input.body ?? '').trim();
    if (title === '' || body === '') throw new InvalidConsentTemplateError();
    this.titleValue = title.slice(0, 200);
    this.bodyValue = body;
  }

  public title(): string {
    return this.titleValue;
  }

  public body(): string {
    return this.bodyValue;
  }
}
