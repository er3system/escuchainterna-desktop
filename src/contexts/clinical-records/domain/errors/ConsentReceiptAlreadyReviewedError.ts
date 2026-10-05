import { DomainError } from '@/shared/domain/DomainError';
export class ConsentReceiptAlreadyReviewedError extends DomainError {
  public constructor() { super('Este documento ya fue revisado. Su copia e historial se conservan.'); }
}
