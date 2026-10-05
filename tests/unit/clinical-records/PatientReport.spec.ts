import { describe, expect, it } from 'vitest';
import { PatientReport } from '@/contexts/clinical-records/domain/PatientReport';
import { ReportNotReviewedError } from '@/contexts/clinical-records/domain/errors/ReportNotReviewedError';
import { SignedReportIsImmutableError } from '@/contexts/clinical-records/domain/errors/SignedReportIsImmutableError';

function draftReport(): PatientReport {
  return PatientReport.draft({
    id: 'rep-1',
    patientId: 'pac-1',
    kind: 'informe_clinico',
    title: 'Informe clínico — Ana',
    content: 'Borrador inicial',
  });
}

describe('PatientReport', () => {
  it('nace como borrador sin firma', () => {
    const primitives = draftReport().toPrimitives();
    expect(primitives.status).toBe('borrador');
    expect(primitives.signedAt).toBeNull();
    expect(primitives.signedBy).toBe('');
  });

  it('no puede firmarse sin revisión previa', () => {
    const report = draftReport();
    expect(() =>
      report.sign({ signedBy: 'Dra. Pérez', licenseNumber: '123456', signedByUserId: 'user-1' }),
    ).toThrow(ReportNotReviewedError);
  });

  it('editar con reviewed=true lo marca revisado y entonces puede firmarse', () => {
    const report = draftReport();
    report.edit({ title: 'Informe', content: 'Contenido revisado', reviewed: true });
    expect(report.toPrimitives().status).toBe('revisado');
    report.sign({ signedBy: 'Dra. Pérez', licenseNumber: '123456', signedByUserId: 'user-1' });
    const primitives = report.toPrimitives();
    expect(primitives.status).toBe('firmado');
    expect(primitives.signedBy).toBe('Dra. Pérez');
    expect(primitives.licenseNumber).toBe('123456');
    expect(primitives.signedByUserId).toBe('user-1');
    expect(primitives.signedAt).not.toBeNull();
  });

  it('la firma exige nombre y cédula', () => {
    const report = draftReport();
    report.edit({ title: 'Informe', content: 'Contenido', reviewed: true });
    expect(() =>
      report.sign({ signedBy: '   ', licenseNumber: '123', signedByUserId: 'user-1' }),
    ).toThrow(ReportNotReviewedError);
    expect(() =>
      report.sign({ signedBy: 'Dra. Pérez', licenseNumber: '  ', signedByUserId: 'user-1' }),
    ).toThrow(ReportNotReviewedError);
  });

  it('editar de nuevo invalida la revisión (vuelve a borrador)', () => {
    const report = draftReport();
    report.edit({ title: 'Informe', content: 'v1', reviewed: true });
    report.edit({ title: 'Informe', content: 'v2', reviewed: false });
    expect(report.toPrimitives().status).toBe('borrador');
    expect(() =>
      report.sign({ signedBy: 'Dra. Pérez', licenseNumber: '123', signedByUserId: 'user-1' }),
    ).toThrow(ReportNotReviewedError);
  });

  it('un reporte firmado es inmutable', () => {
    const report = draftReport();
    report.edit({ title: 'Informe', content: 'Final', reviewed: true });
    report.sign({ signedBy: 'Dra. Pérez', licenseNumber: '123456', signedByUserId: 'user-1' });
    expect(() => report.edit({ title: 'Otro', content: 'Cambio', reviewed: true })).toThrow(
      SignedReportIsImmutableError,
    );
    expect(() =>
      report.sign({ signedBy: 'Otra', licenseNumber: '999', signedByUserId: 'user-2' }),
    ).toThrow(SignedReportIsImmutableError);
  });
});
