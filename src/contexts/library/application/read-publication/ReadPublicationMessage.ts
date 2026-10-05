import { PublicationId } from '../../domain/value-objects/PublicationId';

export class ReadPublicationMessage {
  private readonly publicationId: PublicationId;

  public constructor(input: { publicationId: string }) {
    this.publicationId = new PublicationId(input.publicationId);
  }

  public publicationIdValue(): string {
    return this.publicationId.toString();
  }
}
