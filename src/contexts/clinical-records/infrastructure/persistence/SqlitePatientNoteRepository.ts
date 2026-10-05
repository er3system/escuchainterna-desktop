import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField, isEncrypted } from '@/shared/infrastructure/crypto/FieldEncryption';

/**
 * Notas privadas del paciente (bitácora del psicólogo, migración v29): apuntes
 * sueltos que NO entran al expediente firmable. Scoped por dueño (regla de oro).
 * El body se cifra at-rest; las notas heredadas del antiguo campo `patients.notes`
 * quedaron en claro, así que la lectura descifra solo si está cifrado.
 */
export interface PatientNote {
  id: string;
  body: string;
  createdAt: string;
}

interface PatientNoteRow {
  id: string;
  body: string;
  created_at: string;
}

export class SqlitePatientNoteRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  /** Notas del paciente, más recientes primero. */
  public async list(patientId: string): Promise<PatientNote[]> {
    const rows = await this.db.query<PatientNoteRow>(
      `SELECT id, body, created_at FROM patient_notes
          WHERE owner_user_id = ? AND patient_id = ?
          ORDER BY created_at DESC`,
      [this.ownerUserId, patientId],
    );
    return rows.map((row) => ({
      id: row.id,
      body: isEncrypted(row.body) ? decryptField(row.body) : row.body,
      createdAt: row.created_at,
    }));
  }

  /** Agrega una nota (cifrada at-rest). */
  public async add(patientId: string, body: string): Promise<void> {
    await this.db.execute(
      `INSERT INTO patient_notes (id, owner_user_id, patient_id, body, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), this.ownerUserId, patientId, encryptField(body), new Date().toISOString()],
    );
  }

  /** Borra una nota SOLO si pertenece al dueño y al paciente. */
  public async delete(noteId: string, patientId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM patient_notes WHERE id = ? AND owner_user_id = ? AND patient_id = ?',
      [noteId, this.ownerUserId, patientId],
    );
  }
}
