import { DomainError } from '@/shared/domain/DomainError';

export class ConsentLinkRevokedError extends DomainError {
  public constructor() {
    super('Esta liga de consentimiento fue revocada. Pide a tu profesional que te envíe una nueva.');
  }
}
