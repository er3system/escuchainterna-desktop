import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { PatientConsent } from '../../domain/PatientConsent';
import type { ConsentByTokenRepository } from '../../domain/repositories/ConsentByTokenRepository';
import {
  consentRowToAggregate,
  persistConsent,
  type PatientConsentRow,
} from './SqlitePatientConsentRepository';

interface TokenRow extends PatientConsentRow {
  owner_user_id: string;
}

/**
 * Acceso PÚBLICO por token (página de firma, sin sesión): el token único e
 * impredecible es la credencial, por eso aquí no se filtra por owner. El
 * owner_user_id de la fila se conserva al guardar la firma.
 */
export class SqliteConsentByToken implements ConsentByTokenRepository {
  public constructor(private readonly db: DatabaseAdapter = getDatabaseAdapter()) {}

  public async findByToken(token: string): Promise<PatientConsent | null> {
    const row = await this.rowByToken(token);
    return row ? consentRowToAggregate(row) : null;
  }

  public async save(consent: PatientConsent): Promise<void> {
    const row = await this.rowByToken(consent.toPrimitives().token);
    if (!row) return;
    await persistConsent(consent, row.owner_user_id, this.db);
  }

  private async rowByToken(token: string): Promise<TokenRow | null> {
    return this.db.queryRow<TokenRow>('SELECT * FROM patient_consents WHERE token = ?', [token]);
  }
}
