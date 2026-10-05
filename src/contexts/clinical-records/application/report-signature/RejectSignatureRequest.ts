import type { ReportSignatureRequestRepository } from '../../domain/repositories/ReportSignatureRequestRepository';
import { SignatureRequestNotFoundError } from '../../domain/errors/SignatureRequestNotFoundError';
import type { SupervisionChecker } from './RequestReportSignature';

/**
 * El supervisor rechaza una solicitud de co-firma con un motivo. Mismo gate de vigencia
 * que la firma: si el vínculo ya no está activo (revocado/baja), no puede resolverla
 * (simetría con SignRequestedReport y la vista de revisión).
 */
export class RejectSignatureRequest {
  public constructor(
    private readonly requests: ReportSignatureRequestRepository,
    private readonly supervision: SupervisionChecker,
  ) {}

  public async execute(input: {
    requestId: string;
    supervisorUserId: string;
    reason: string;
  }): Promise<void> {
    const request = await this.requests.findById(input.requestId);
    if (!request || !request.isPending() || !request.addressedTo(input.supervisorUserId)) {
      throw new SignatureRequestNotFoundError();
    }
    if (
      !(await this.supervision.supervises(
        input.supervisorUserId,
        request.requester(),
        request.organization(),
      ))
    ) {
      throw new SignatureRequestNotFoundError();
    }
    request.reject(input.reason);
    await this.requests.save(request);
  }
}
