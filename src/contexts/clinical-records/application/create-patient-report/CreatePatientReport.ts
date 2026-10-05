import { randomUUID } from 'node:crypto';
import type { PatientReportData, SessionInsights } from '../../domain/SessionInsights';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import { PatientReport } from '../../domain/PatientReport';
import { guidelineForCountry } from '../../domain/value-objects/countryGuidelines';
import { PATIENT_REPORT_KIND_LABELS, type PatientReportKind } from '../../domain/value-objects/patientReportKinds';
import { ClinicalRecordNotFoundError } from '../../domain/errors/ClinicalRecordNotFoundError';
import type { CreatePatientReportMessage } from './CreatePatientReportMessage';

/** El adaptador local de IA distingue los tipos con estas claves cortas. */
const INSIGHTS_KIND: Record<PatientReportKind, string> = {
  informe_clinico: 'clinico',
  requerimiento_judicial: 'legal',
  constancia_atencion: 'constancia',
  riesgo_derivacion: 'riesgo',
  // 'expediente' no se redacta por IA (se ensambla en CreateExpedienteReport);
  // el mensaje lo rechaza, así que esta entrada nunca se usa.
  expediente: 'expediente',
};

/**
 * Crea un reporte firmable (spec v2 §7): junta los datos del paciente y del
 * profesional, pide a la IA el borrador con los lineamientos normativos del
 * país elegido y lo guarda SIEMPRE como borrador (revisión + firma humanas).
 */
export class CreatePatientReport {
  public constructor(
    private readonly patients: PatientDirectory,
    private readonly diagnoses: DiagnosisRepository,
    private readonly notes: SessionNoteRepository,
    private readonly identity: ProfessionalIdentityReader,
    private readonly reports: PatientReportRepository,
    private readonly insights: SessionInsights,
  ) {}

  public async execute(message: CreatePatientReportMessage): Promise<string> {
    const patient = await this.patients.findSummary(message.patientId());
    if (!patient) throw new ClinicalRecordNotFoundError(message.patientId());

    const professional = await this.identity.read();
    const notes = await this.notes.listByPatient(patient.id);
    const patientNotes = notes
      .map((note) => note.toPrimitives())
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const patientDiagnoses = await this.diagnoses.listByPatient(patient.id);

    const data: PatientReportData = {
      patientName: patient.fullName,
      birthDate: patient.birthDate,
      gender: patient.gender,
      consultationReason: patient.consultationReason,
      therapyStartDate: patient.therapyStartDate,
      diagnoses: patientDiagnoses.map((diagnosis) => {
        const primitives = diagnosis.toPrimitives();
        return { code: primitives.cie11Code, title: primitives.cie11Title, status: primitives.status };
      }),
      sessionNotesCount: patientNotes.length,
      firstNoteAt: patientNotes[0]?.createdAt.slice(0, 10) ?? null,
      lastNoteAt: patientNotes[patientNotes.length - 1]?.createdAt.slice(0, 10) ?? null,
      professionalName: professional?.fullName ?? '',
      professionalLicense: professional?.professionalLicense ?? '',
    };

    const guideline = guidelineForCountry(message.countryCode());
    const content = await this.insights.draftPatientReport(
      INSIGHTS_KIND[message.kind()],
      data,
      `${guideline.name}: ${guideline.guidelines}`,
    );

    const report = PatientReport.draft({
      id: randomUUID(),
      patientId: patient.id,
      kind: message.kind(),
      title: `${PATIENT_REPORT_KIND_LABELS[message.kind()]} — ${patient.fullName}`,
      content,
    });
    await this.reports.save(report);
    return report.reportId();
  }
}
