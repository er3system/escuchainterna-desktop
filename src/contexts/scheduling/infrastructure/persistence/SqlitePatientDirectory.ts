import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type { PatientContact, PatientDirectory } from '../../domain/PatientDirectory';

interface PatientRow {
  id: string;
  full_name: string;
  phone: string;
  phone_country_code: string;
  email: string;
}

/**
 * Anticorrupción mínima sobre la tabla `patients` del contexto de pacientes,
 * acotada al dueño (owner_user_id): la página pública crea pacientes con el
 * owner resuelto a partir del slug.
 *
 * El teléfono del contacto se expone en formato internacional (lada + número)
 * para que los mensajes de WhatsApp del outbox salgan con el indicativo del país.
 */
export class SqlitePatientDirectory implements PatientDirectory {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async findById(id: string): Promise<PatientContact | null> {
    const row = await this.db.queryRow<PatientRow>(
      'SELECT id, full_name, phone, phone_country_code, email FROM patients WHERE id = ? AND owner_user_id = ?',
      [id, this.ownerUserId],
    );
    return row ? SqlitePatientDirectory.toContact(row) : null;
  }

  public async findOrCreateByContact(input: {
    fullName: string;
    email: string;
    phone: string;
    phoneCountryCode?: string;
  }): Promise<PatientContact> {
    const email = input.email.trim().toLowerCase();
    const phone = input.phone.trim();
    const dialCode = (input.phoneCountryCode ?? '').trim() || '+52';

    let row: PatientRow | null = null;
    if (email) {
      row = await this.db.queryRow<PatientRow>(
        `SELECT id, full_name, phone, phone_country_code, email FROM patients
           WHERE lower(email) = ? AND archived = 0 AND owner_user_id = ? LIMIT 1`,
        [email, this.ownerUserId],
      );
    }
    if (!row && phone) {
      row = await this.db.queryRow<PatientRow>(
        `SELECT id, full_name, phone, phone_country_code, email FROM patients
           WHERE phone = ? AND archived = 0 AND owner_user_id = ? LIMIT 1`,
        [phone, this.ownerUserId],
      );
    }
    if (row) {
      return SqlitePatientDirectory.toContact(row);
    }

    const id = randomUUID();
    await this.db.execute(
      `INSERT INTO patients (id, full_name, email, phone, phone_country_code, created_at, owner_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.fullName.trim(), email, phone, dialCode, new Date().toISOString(), this.ownerUserId],
    );
    return {
      id,
      fullName: input.fullName.trim(),
      phone: SqlitePatientDirectory.internationalPhone(dialCode, phone),
      email,
    };
  }

  private static toContact(row: PatientRow): PatientContact {
    return {
      id: row.id,
      fullName: row.full_name,
      phone: SqlitePatientDirectory.internationalPhone(row.phone_country_code, row.phone),
      email: row.email,
    };
  }

  /** «+52» + «2221234567» → «+52 2221234567»; respeta números ya internacionales. */
  private static internationalPhone(dialCode: string, phone: string): string {
    const number = (phone ?? '').trim();
    if (!number) return '';
    if (number.startsWith('+')) return number;
    const dial = (dialCode ?? '').trim();
    return dial ? `${dial} ${number}` : number;
  }
}
