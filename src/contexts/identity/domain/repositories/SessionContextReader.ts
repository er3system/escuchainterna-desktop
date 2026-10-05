import type { SessionContext } from '../../application/get-session-context/SessionContext';

export interface SessionContextReader {
  read(userId: string): Promise<SessionContext | null>;
}
