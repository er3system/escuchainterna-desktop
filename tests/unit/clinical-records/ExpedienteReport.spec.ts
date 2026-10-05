import { describe, expect, it } from 'vitest';
import { buildExpedienteMarkdown, expedienteGaps } from '@/contexts/clinical-records/domain/expedienteContent';
import { ClinicalRecord } from '@/contexts/clinical-records/domain/ClinicalRecord';
import { SessionNote } from '@/contexts/clinical-records/domain/SessionNote';
import { PatientReport } from '@/contexts/clinical-records/domain/PatientReport';
import { historiaNucleoSections } from '@/contexts/clinical-records/domain/historiaBlocks';
import { isPatientReportKind } from '@/contexts/clinical-records/domain/value-objects/patientReportKinds';
import type { ClinicalRecordRepository } from '@/contexts/clinical-records/domain/repositories/ClinicalRecordRepository';
import type { SessionNoteRepository } from '@/contexts/clinical-records/domain/repositories/SessionNoteRepository';
import type { PatientDirectory } from '@/contexts/clinical-records/domain/repositories/PatientDirectory';
import type { ProfessionalIdentityReader } from '@/contexts/clinical-records/domain/repositories/ProfessionalIdentityReader';
import type { DiagnosisRepository } from '@/contexts/clinical-records/domain/repositories/DiagnosisRepository';
import type { PatientReportRepository } from '@/contexts/clinical-records/domain/repositories/PatientReportRepository';
import { CreateExpedienteReport } from '@/contexts/clinical-records/application/create-expediente-report/CreateExpedienteReport';
import { CreatePatientReportMessage } from '@/contexts/clinical-records/application/create-patient-report/CreatePatientReportMessage';

describe('buildExpedienteMarkdown', () => {
  it('arma núcleo, Evolución y diagnósticos, y omite huecos cuando hay datos', () => {
    const md = buildExpedienteMarkdown({
      generatedAt: '2026-06-13T10:00:00.000Z',
      patientName: 'Ana Pérez',
      birthDate: '1990-01-01',
      gender: 'Femenino',
      professionalName: 'Dra. X',
      professionalLicense: 'TP-123',
      history: {
        title: 'Historia clínica',
        sections: [{ id: 's1', title: 'Motivo', fields: [{ id: 'f1', label: 'Motivo', type: 'texto_largo' }] }],
        answers: { f1: 'ansiedad situacional' },
      },
      evolucion: [
        {
          title: 'Sesión 1',
          kind: 'primera',
          templateId: 'session-primera',
          date: '2026-06-10T09:00:00.000Z',
          content: 'trabajamos respiración',
          answers: { 'bloque:registro-pensamientos::situacion': 'examen de mañana' },
          sections: [
            {
              id: 'bloque:registro-pensamientos',
              title: 'Registro de pensamientos',
              fields: [{ id: 'bloque:registro-pensamientos::situacion', label: 'Situación', type: 'texto_largo' }],
            },
          ],
        },
      ],
      diagnoses: [{ code: '6A70', title: 'Depresión', status: 'activo', kind: 'formal' }],
    });
    expect(md).toContain('# Historia clínica completa — Ana Pérez');
    expect(md).toContain('**Motivo:** ansiedad situacional');
    expect(md).toContain('## Evolución (sesiones)');
    expect(md).toContain('trabajamos respiración');
    // El bloque de la sesión se vuelca con sus campos (ya no es un resumen de una línea).
    expect(md).toContain('**Registro de pensamientos**');
    expect(md).toContain('**Situación:** examen de mañana');
    expect(md).toContain('6A70 — Depresión (activo · diagnóstico formal)');
    expect(md).not.toContain('No consta un diagnóstico');
    // Los huecos NUNCA van dentro del documento firmable.
    expect(md).not.toContain('## Lo que no consta en el expediente');
  });

  it('el documento firmable NO incluye la sección de huecos aunque el expediente esté vacío', () => {
    const md = buildExpedienteMarkdown({
      generatedAt: '2026-06-13T10:00:00.000Z',
      patientName: 'X',
      birthDate: null,
      gender: '',
      professionalName: '',
      professionalLicense: '',
      history: null,
      evolucion: [],
      diagnoses: [],
    });
    expect(md).not.toContain('## Lo que no consta en el expediente');
    expect(md).not.toContain('El núcleo de la historia clínica está vacío.');
  });

  it('expedienteGaps expone los huecos para el checklist de la UI (fuera del PDF)', () => {
    const gaps = expedienteGaps({
      generatedAt: '2026-06-13T10:00:00.000Z',
      patientName: 'X',
      birthDate: null,
      gender: '',
      professionalName: '',
      professionalLicense: '',
      history: null,
      evolucion: [],
      diagnoses: [],
    });
    expect(gaps).toContain('El núcleo de la historia clínica está vacío.');
    expect(gaps).toContain('No hay sesiones registradas en la Evolución.');
    expect(gaps).toContain('No consta un diagnóstico CIE-11 registrado.');
  });
});

class InMemoryRecords implements ClinicalRecordRepository {
  public constructor(private readonly primary: ClinicalRecord | null) {}
  public async save(): Promise<void> {}
  public async findById(): Promise<ClinicalRecord | null> {
    return this.primary;
  }
  public async listByPatient(): Promise<ClinicalRecord[]> {
    return this.primary ? [this.primary] : [];
  }
  public async findPrimaryHistory(): Promise<ClinicalRecord | null> {
    return this.primary;
  }
  public async delete(): Promise<void> {}
}

class InMemoryNotes implements SessionNoteRepository {
  public constructor(private readonly notes: SessionNote[]) {}
  public async save(): Promise<void> {}
  public async findById(): Promise<SessionNote | null> {
    return null;
  }
  public async listByPatient(): Promise<SessionNote[]> {
    return this.notes;
  }
  public async delete(): Promise<void> {}
}

describe('CreateExpedienteReport', () => {
  it('ensambla un borrador kind=expediente con núcleo y TODAS las sesiones no archivadas', async () => {
    const primary = ClinicalRecord.start({
      id: 'h1',
      patientId: 'p1',
      templateId: null,
      title: 'Historia clínica',
      sections: historiaNucleoSections(),
      kind: 'historia',
    });
    const nucleoField = historiaNucleoSections()[0].fields[0].id;
    primary.answerField(nucleoField, 'Motivo de prueba');

    const integrada = SessionNote.create({
      id: 'n1',
      patientId: 'p1',
      bookingId: null,
      title: 'Sesión A',
      templateId: 'session-primera',
      sessionKind: 'primera',
    });
    integrada.edit('Sesión A', 'trabajamos respiración diafragmática');
    const otra = SessionNote.create({ id: 'n2', patientId: 'p1', bookingId: null, title: 'Sesión B' });
    otra.edit('Sesión B', 'segunda sesión de seguimiento');
    // Una archivada NO debe aparecer en el documento (quitada de la Evolución).
    const archivada = SessionNote.create({ id: 'n3', patientId: 'p1', bookingId: null, title: 'Sesión Archivada' });
    archivada.edit('Sesión Archivada', 'no debe aparecer');
    archivada.archive();

    const patients = {
      findSummary: () =>
        Promise.resolve({
          id: 'p1',
          fullName: 'Ana Pérez',
          birthDate: '1990-01-01',
          gender: 'Femenino',
          consultationReason: '',
          therapyStartDate: null,
        }),
    } as unknown as PatientDirectory;
    const identity = {
      read: () => Promise.resolve({ fullName: 'Dra. X', professionalLicense: 'TP-9' }),
    } as unknown as ProfessionalIdentityReader;
    const diagnoses = {
      listByPatient: () =>
        Promise.resolve([
          { toPrimitives: () => ({ cie11Code: '6A70', cie11Title: 'Depresión', status: 'activo' }) },
        ]),
    } as unknown as DiagnosisRepository;

    let saved: PatientReport | null = null;
    const reports = {
      save: (report: PatientReport) => {
        saved = report;
        return Promise.resolve();
      },
      findById: () => Promise.resolve(null),
      listByPatient: () => Promise.resolve([]),
      delete: () => Promise.resolve(),
    } as unknown as PatientReportRepository;

    const reportId = await new CreateExpedienteReport(
      patients,
      new InMemoryRecords(primary),
      new InMemoryNotes([integrada, otra, archivada]),
      diagnoses,
      identity,
      reports,
    ).execute('p1');

    expect(reportId).toBeTruthy();
    const primitives = saved!.toPrimitives();
    expect(primitives.kind).toBe('expediente');
    expect(primitives.status).toBe('borrador');
    expect(primitives.title).toContain('Ana Pérez');
    expect(primitives.content).toContain('Motivo de prueba');
    expect(primitives.content).toContain('trabajamos respiración diafragmática');
    expect(primitives.content).toContain('Sesión A');
    expect(primitives.content).toContain('Sesión B'); // no archivada → incluida (ya no hace falta "integrar")
    expect(primitives.content).not.toContain('Sesión Archivada'); // archivada → excluida
    expect(primitives.content).toContain('6A70 — Depresión');
  });
});

describe('tipos de reporte', () => {
  it("'expediente' es un kind válido pero NO se redacta por IA", () => {
    expect(isPatientReportKind('expediente')).toBe(true);
    expect(isPatientReportKind('desconocido')).toBe(false);
    expect(
      () => new CreatePatientReportMessage({ patientId: 'p1', kind: 'expediente', countryCode: 'CO' }),
    ).toThrow();
  });
});
