import type { ExpedienteInput, ExpedienteSession } from '../../domain/expedienteContent';
import { sessionKindForTemplateId, sessionTemplateForKind } from '../../domain/sessionTemplates';
import type { PatientDirectory } from '../../domain/repositories/PatientDirectory';
import type { ProfessionalIdentityReader } from '../../domain/repositories/ProfessionalIdentityReader';
import type { ClinicalRecordRepository } from '../../domain/repositories/ClinicalRecordRepository';
import type { SessionNoteRepository } from '../../domain/repositories/SessionNoteRepository';
import type { DiagnosisRepository } from '../../domain/repositories/DiagnosisRepository';

export interface ExpedienteSources {
  patients: PatientDirectory;
  records: ClinicalRecordRepository;
  notes: SessionNoteRepository;
  diagnoses: DiagnosisRepository;
  identity: ProfessionalIdentityReader;
}

/**
 * Reúne los datos del expediente consolidado (núcleo + Evolución integrada +
 * diagnósticos + identidad profesional) en un `ExpedienteInput`. Lo comparten el
 * ensamblado del documento firmable y el cálculo de huecos para el checklist de
 * la UI. Devuelve null si el paciente no existe.
 */
export async function assembleExpedienteInput(
  sources: ExpedienteSources,
  patientId: string,
  generatedAt: string,
): Promise<ExpedienteInput | null> {
  const patient = await sources.patients.findSummary(patientId);
  if (!patient) return null;
  const professional = await sources.identity.read();

  const primary = await sources.records.findPrimaryHistory(patientId);
  const history = primary
    ? (() => {
        const primitives = primary.toPrimitives();
        return { title: primitives.title, sections: primitives.sections ?? [], answers: primitives.answers };
      })()
    : null;

  // El Documento es la colección de TODO lo de Evolución: todas las sesiones no
  // archivadas (las archivadas se quitaron de la Evolución y no cuentan). Cada
  // sesión se vuelca completa: formulario base (1ª/seguimiento) + sus bloques.
  const evolucion: ExpedienteSession[] = (await sources.notes.listByPatient(patientId))
    .map((note) => note.toPrimitives())
    .filter((note) => !note.archived)
    // Orden manual de la Evolución (P8): position ASC; createdAt como desempate.
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.createdAt.localeCompare(b.createdAt))
    .map((note) => {
      const kind = sessionKindForTemplateId(note.templateId);
      const baseSections = kind ? sessionTemplateForKind(kind).sections : [];
      return {
        title: note.title,
        kind: note.sessionKind,
        templateId: note.templateId,
        date: note.createdAt,
        content: note.content,
        answers: note.answers,
        sections: [...baseSections, ...(note.sections ?? [])],
      };
    });

  const diagnoses = (await sources.diagnoses.listByPatient(patientId)).map((diagnosis) => {
    const primitives = diagnosis.toPrimitives();
    return {
      code: primitives.cie11Code,
      title: primitives.cie11Title,
      status: primitives.status,
      kind: primitives.kind,
    };
  });

  return {
    generatedAt,
    patientName: patient.fullName,
    birthDate: patient.birthDate,
    gender: patient.gender,
    professionalName: professional?.fullName ?? '',
    professionalLicense: professional?.professionalLicense ?? '',
    history,
    evolucion,
    diagnoses,
  };
}
