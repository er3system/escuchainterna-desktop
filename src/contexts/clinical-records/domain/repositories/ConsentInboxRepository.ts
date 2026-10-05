import type { ReceivedConsent } from '../ReceivedConsent';
import type { ConsentReceptionId } from '../value-objects/ConsentReceptionId';
export interface ConsentInboxRepository {
  find(id: ConsentReceptionId): Promise<ReceivedConsent | null>;
  hasContent(hash: string): Promise<boolean>;
  findPatientByReceptionCode(code: ConsentReceptionId): Promise<ConsentReceptionId | null>;
  save(receipt: ReceivedConsent): Promise<void>;
}
