import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { AiConsentGate } from '../../domain/AiConsentGate';

/**
 * Impl Sqlite del gate de consentimiento-IA, acotada al dueño de la sesión (owner_user_id en el
 * WHERE, igual que el retriever). Mira el ÚLTIMO consentimiento del paciente y autoriza SOLO si
 * está otorgado (firmado/papel_adjunto), no revocado y con ai_authorized=1. fail-closed: sin
 * consentimiento, o si el más reciente no autoriza IA, devuelve false. La revocación (revoked_at)
 * corta el canal IA sola. Lee solo el flag/estado — jamás contenido clínico.
 */
export class SqliteAiConsentGate implements AiConsentGate {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async isAuthorized(patientId: string): Promise<boolean> {
    const row = await this.db.queryRow<{ ai_authorized: number; status: string; revoked_at: string | null }>(
      `SELECT ai_authorized, status, revoked_at
         FROM patient_consents
        WHERE patient_id = ? AND owner_user_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 1`,
      [patientId, this.ownerUserId],
    );
    if (!row) return false;
    return (
      row.ai_authorized === 1 &&
      row.revoked_at === null &&
      (row.status === 'firmado' || row.status === 'papel_adjunto')
    );
  }
}
