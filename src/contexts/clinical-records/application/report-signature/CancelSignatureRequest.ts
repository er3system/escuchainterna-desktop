import type { ReportSignatureRequestRepository } from '../../domain/repositories/ReportSignatureRequestRepository';
import { SignatureRequestNotFoundError } from '../../domain/errors/SignatureRequestNotFoundError';

/** El practicante cancela su propia solicitud de co-firma aún pendiente. */
export class CancelSignatureRequest {
  public constructor(private readonly requests: ReportSignatureRequestRepository) {}

  public async execute(input: { requestId: string; requesterUserId: string }): Promise<void> {
    const request = await this.requests.findById(input.requestId);
    if (!request || !request.isPending() || !request.requestedBy(input.requesterUserId)) {
      throw new SignatureRequestNotFoundError();
    }
    request.cancel();
    await this.requests.save(request);
  }
}
