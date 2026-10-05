import { describe, it, expect } from 'vitest';
import { PatientReport } from '@/contexts/clinical-records/domain/PatientReport';
import type { PatientReportRepository } from '@/contexts/clinical-records/domain/repositories/PatientReportRepository';
import type {
  ProfessionalIdentity,
  ProfessionalIdentityReader,
} from '@/contexts/clinical-records/domain/repositories/ProfessionalIdentityReader';
import { SignPatientReport } from '@/contexts/clinical-records/application/sign-patient-report/SignPatientReport';
import { SignPatientReportMessage } from '@/contexts/clinical-records/application/sign-patient-report/SignPatientReportMessage';
import { UpdatePatientReport } from '@/contexts/clinical-records/application/update-patient-report/UpdatePatientReport';
import { UpdatePatientReportMessage } from '@/contexts/clinical-records/application/update-patient-report/UpdatePatientReportMessage';
import { DeletePatientReport } from '@/contexts/clinical-records/application/delete-patient-report/DeletePatientReport';
import { SignedReportIsImmutableError } from '@/contexts/clinical-records/domain/errors/SignedReportIsImmutableError';
import { PatientReportNotFoundError } from '@/contexts/clinical-records/domain/errors/PatientReportNotFoundError';
import { ProfessionalLicenseRequiredError } from '@/contexts/clinical-records/domain/errors/ProfessionalLicenseRequiredError';

/** Doble en memoria del repositorio (patrón de DemotePrimaryHistory.spec.ts). */
class InMemoryReports implements PatientReportRepository {
  public readonly reports: PatientReport[] = [];
  public async save(report: PatientReport): Promise<void> {
    const i = this.reports.findIndex((r) => r.reportId() === report.reportId());
    if (i >= 0) this.reports[i] = report;
    else this.reports.push(report);
  }
  public async findById(id: string): Promise<PatientReport | null> {
    return this.reports.find((r) => r.reportId() === id) ?? null;
  }
  public async listByPatient(patientId: string): Promise<PatientReport[]> {
    return this.reports.filter((r) => r.belongsTo(patientId));
  }
  public async delete(id: string): Promise<void> {
    const i = this.reports.findIndex((r) => r.reportId() === id);
    if (i >= 0) this.reports.splice(i, 1);
  }
}

/** Identidad del profesional firmante (perfil del usuario autenticado). */
function identityReader(overrides: Partial<ProfessionalIdentity> = {}): ProfessionalIdentityReader {
  const identity: ProfessionalIdentity = {
    fullName: 'Dra. Pérez',
    professionalLicense: '123456',
    email: 'perez@example.com',
    contactPhone: '',
    contactAddress: '',
    organizationName: null,
    organizationLogoDataUri: null,
    ...overrides,
  };
  return { read: () => Promise.resolve(identity) };
}

/** Lector sin licencia (practicante): el gate de firma debe bloquearlo. */
const noLicenseReader: ProfessionalIdentityReader = identityReader({ professionalLicense: '' });

function draft(id: string, patientId = 'pac-1'): PatientReport {
  return PatientReport.draft({
    id,
    patientId,
    kind: 'informe_clinico',
    title: 'Informe clínico — Ana',
    content: 'Borrador inicial',
  });
}

/** Un reporte ya revisado y firmado, listo para probar inmutabilidad. */
function signed(id: string, patientId = 'pac-1'): PatientReport {
  const report = draft(id, patientId);
  report.edit({ title: 'Informe', content: 'Final', reviewed: true });
  report.sign({ signedBy: 'Dra. Pérez', licenseNumber: '123456', signedByUserId: 'user-1' });
  return report;
}

describe('Casos de uso de PatientReport (capa de aplicación)', () => {
  describe('DeletePatientReport · retención', () => {
    it('borra un borrador', async () => {
      const repo = new InMemoryReports();
      await repo.save(draft('rep-1'));

      await new DeletePatientReport(repo).execute('rep-1', 'pac-1');

      expect(await repo.findById('rep-1')).toBeNull();
    });

    it('RECHAZA borrar un reporte firmado (documento legal inmutable)', async () => {
      const repo = new InMemoryReports();
      await repo.save(signed('rep-2'));

      await expect(new DeletePatientReport(repo).execute('rep-2', 'pac-1')).rejects.toThrow(
        SignedReportIsImmutableError,
      );
      // Se conserva: el firmado sigue en el repositorio.
      expect(await repo.findById('rep-2')).not.toBeNull();
    });
  });

  describe('scoping por paciente', () => {
    it('SignPatientReport rechaza un reporte de otro paciente', async () => {
      const repo = new InMemoryReports();
      await repo.save(draft('rep-1', 'pac-1'));

      await expect(
        new SignPatientReport(repo, identityReader()).execute(
          new SignPatientReportMessage({
            reportId: 'rep-1',
            patientId: 'otro-pac',
            signerUserId: 'user-1',
          }),
        ),
      ).rejects.toThrow(PatientReportNotFoundError);
    });

    it('UpdatePatientReport rechaza un reporte de otro paciente', async () => {
      const repo = new InMemoryReports();
      await repo.save(draft('rep-1', 'pac-1'));

      await expect(
        new UpdatePatientReport(repo).execute(
          new UpdatePatientReportMessage({
            reportId: 'rep-1',
            patientId: 'otro-pac',
            title: 'Hackeado',
            content: 'No debería entrar',
            reviewed: false,
          }),
        ),
      ).rejects.toThrow(PatientReportNotFoundError);
    });

    it('DeletePatientReport rechaza un reporte de otro paciente', async () => {
      const repo = new InMemoryReports();
      await repo.save(draft('rep-1', 'pac-1'));

      await expect(new DeletePatientReport(repo).execute('rep-1', 'otro-pac')).rejects.toThrow(
        PatientReportNotFoundError,
      );
      // No se tocó el reporte del paciente legítimo.
      expect(await repo.findById('rep-1')).not.toBeNull();
    });
  });

  describe('SignPatientReport · firma y persiste', () => {
    it('firma con la identidad del PERFIL (no texto libre) y deja sello de fecha y firmante', async () => {
      const repo = new InMemoryReports();
      const report = draft('rep-1');
      report.edit({ title: 'Informe', content: 'Contenido revisado', reviewed: true });
      await repo.save(report);

      // El cliente NO aporta nombre ni cédula: vienen del perfil del firmante.
      await new SignPatientReport(repo, identityReader({ fullName: 'Dra. Gómez', professionalLicense: '987654' })).execute(
        new SignPatientReportMessage({
          reportId: 'rep-1',
          patientId: 'pac-1',
          signerUserId: 'user-42',
        }),
      );

      const after = (await repo.findById('rep-1'))!.toPrimitives();
      expect(after.status).toBe('firmado');
      expect(after.signedBy).toBe('Dra. Gómez');
      expect(after.licenseNumber).toBe('987654');
      expect(after.signedByUserId).toBe('user-42');
      expect(after.signedAt).not.toBeNull();
    });

    it('RECHAZA firmar si el perfil no tiene tarjeta profesional (practicante sin licencia)', async () => {
      const repo = new InMemoryReports();
      const report = draft('rep-1');
      report.edit({ title: 'Informe', content: 'Contenido revisado', reviewed: true });
      await repo.save(report);

      await expect(
        new SignPatientReport(repo, noLicenseReader).execute(
          new SignPatientReportMessage({ reportId: 'rep-1', patientId: 'pac-1', signerUserId: 'estudiante-1' }),
        ),
      ).rejects.toThrow(ProfessionalLicenseRequiredError);

      // El reporte sigue sin firmar: nadie pudo emitir un documento legal sin licencia.
      expect((await repo.findById('rep-1'))!.toPrimitives().status).toBe('revisado');
    });
  });

  describe('UpdatePatientReport · edita y pasa reviewed al agregado', () => {
    it('edita el contenido y, con reviewed=true, lo marca revisado', async () => {
      const repo = new InMemoryReports();
      await repo.save(draft('rep-1'));

      await new UpdatePatientReport(repo).execute(
        new UpdatePatientReportMessage({
          reportId: 'rep-1',
          patientId: 'pac-1',
          title: 'Informe corregido',
          content: 'Contenido revisado por el profesional',
          reviewed: true,
        }),
      );

      const after = (await repo.findById('rep-1'))!.toPrimitives();
      expect(after.title).toBe('Informe corregido');
      expect(after.content).toBe('Contenido revisado por el profesional');
      expect(after.status).toBe('revisado');
    });

    it('con reviewed=false la edición deja el reporte en borrador', async () => {
      const repo = new InMemoryReports();
      await repo.save(draft('rep-1'));

      await new UpdatePatientReport(repo).execute(
        new UpdatePatientReportMessage({
          reportId: 'rep-1',
          patientId: 'pac-1',
          title: 'Sigue en borrador',
          content: 'Aún sin revisar',
          reviewed: false,
        }),
      );

      expect((await repo.findById('rep-1'))!.toPrimitives().status).toBe('borrador');
    });
  });
});
