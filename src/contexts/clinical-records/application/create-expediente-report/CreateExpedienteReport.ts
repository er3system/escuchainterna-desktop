import { randomUUID } from 'node:crypto';
import { PatientReport } from '../../domain/PatientReport';
import { buildExpedienteMarkdown } from '../../domain/expedienteContent';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';
import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import { assembleExpedienteInput } from './assembleExpedienteInput';

/**
 * Ensambla la "Historia clínica completa" del paciente (núcleo + bloques +
 * Evolución + diagnósticos) y la guarda como un patient_report kind='expediente'
 * en estado borrador. DETERMINISTA (sin IA): comparte la tubería de revisión y
 * firma con el resto de reportes. Cada generación crea un borrador nuevo (foto
 * del expediente al momento de generarlo).
 */
export class CreateExpedienteReport {
  public constructor(
    private readonly patients: PatientDirectory,
    private readonly records: ClinicalRecordRepository,
    private readonly notes: SessionNoteRepository,
    private readonly diagnoses: DiagnosisRepository,
    private readonly identity: ProfessionalIdentityReader,
    private readonly reports: PatientReportRepository,
  ) {}

  public async execute(patientId: string): Promise<string> {
    const input = await assembleExpedienteInput(
      {
        patients: this.patients,
        records: this.records,
        notes: this.notes,
        diagnoses: this.diagnoses,
        identity: this.identity,
      },
      patientId,
      new Date().toISOString(),
    );
    if (!input) throw new ClinicalRecordNotFoundError(patientId);

    const content = buildExpedienteMarkdown(input);
    const report = PatientReport.draft({
      id: randomUUID(),
      patientId,
      kind: 'expediente',
      title: `Historia clínica completa — ${input.patientName}`,
      content,
    });
    await this.reports.save(report);
    return report.reportId();
  }
}
