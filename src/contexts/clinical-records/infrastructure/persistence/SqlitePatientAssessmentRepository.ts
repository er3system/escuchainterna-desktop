import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { decryptField, encryptField, isEncrypted } from '@/shared/infrastructure/crypto/FieldEncryption';

/**
 * Cuestionarios/escalas APLICADOS al paciente (migración v33): PHQ-9, GAD-7…
 * Cada aplicación guarda respuestas, puntaje total y severidad para seguir la
 * evolución. Scoped por dueño (regla de oro). El puntaje/severidad van en claro
 * (necesarios para ordenar/graficar la tendencia); el comentario libre se cifra.
 */
export interface PatientAssessment {
  id: string;
  instrumentId: string;
  answers: number[];
  totalScore: number;
  severity: string;
  riskFlag: boolean;
  notes: string;
  appliedAt: string;
}

export interface NewPatientAssessment {
  instrumentId: string;
  answers: number[];
  totalScore: number;
  severity: string;
  riskFlag: boolean;
  notes: string;
}

interface PatientAssessmentRow {
  id: string;
  instrument_id: string;
  answers_json: string;
  total_score: number;
  severity: string;
  risk_flag: number;
  notes: string;
  applied_at: string;
}

function parseAnswers(json: string): number[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((value) => (typeof value === 'number' ? value : 0));
  } catch {
    return [];
  }
}

export class SqlitePatientAssessmentRepository {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  /** Aplicaciones del paciente, más recientes primero. */
  public async list(patientId: string): Promise<PatientAssessment[]> {
    const rows = await this.db.query<PatientAssessmentRow>(
      `SELECT id, instrument_id, answers_json, total_score, severity, risk_flag, notes, applied_at
           FROM patient_assessments
          WHERE owner_user_id = ? AND patient_id = ?
          ORDER BY applied_at DESC`,
      [this.ownerUserId, patientId],
    );
    return rows.map((row) => ({
      id: row.id,
      instrumentId: row.instrument_id,
      answers: parseAnswers(row.answers_json),
      totalScore: row.total_score,
      severity: row.severity,
      riskFlag: row.risk_flag === 1,
      notes: row.notes ? (isEncrypted(row.notes) ? decryptField(row.notes) : row.notes) : '',
      appliedAt: row.applied_at,
    }));
  }

  /** Registra una aplicación (comentario cifrado at-rest). */
  public async add(patientId: string, assessment: NewPatientAssessment): Promise<void> {
    await this.db.execute(
      `INSERT INTO patient_assessments
           (id, owner_user_id, patient_id, instrument_id, answers_json, total_score, severity, risk_flag, notes, applied_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        this.ownerUserId,
        patientId,
        assessment.instrumentId,
        JSON.stringify(assessment.answers),
        assessment.totalScore,
        assessment.severity,
        assessment.riskFlag ? 1 : 0,
        assessment.notes ? encryptField(assessment.notes) : '',
        new Date().toISOString(),
      ],
    );
  }

  /** Borra una aplicación SOLO si pertenece al dueño y al paciente. */
  public async delete(assessmentId: string, patientId: string): Promise<void> {
    await this.db.execute(
      'DELETE FROM patient_assessments WHERE id = ? AND owner_user_id = ? AND patient_id = ?',
      [assessmentId, this.ownerUserId, patientId],
    );
  }
}
