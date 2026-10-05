import type { SessionContextReader } from '../../domain/repositories/SessionContextReader';
import type { SessionContext } from './SessionContext';

/** userId → contexto de sesión (rol, org, permisos, suscripción). */
export class GetSessionContext {
  public constructor(private readonly reader: SessionContextReader) {}

  public async get(userId: string): Promise<SessionContext | null> {
    return this.reader.read(userId);
  }
}
