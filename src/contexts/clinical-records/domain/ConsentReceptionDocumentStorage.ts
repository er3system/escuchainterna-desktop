import type { ConsentReceptionId } from './value-objects/ConsentReceptionId';
import type { ConsentDocumentContent } from './value-objects/ConsentDocumentContent';
export interface ConsentReceptionDocumentStorage { save(id: ConsentReceptionId, content: ConsentDocumentContent): Promise<string>; delete(storedPath: string): Promise<void>; }
