import { describe, it, expect } from 'vitest';
import { PatientReport } from '@/contexts/clinical-records/domain/PatientReport';
import {
  ReportSignatureRequest,
  SignatureRequestAlreadyResolvedError,
} from '@/contexts/clinical-records/domain/ReportSignatureRequest';
import type { PatientReportRepository } from '@/contexts/clinical-records/domain/repositories/PatientReportRepository';
import type { ReportSignatureRequestRepository } from '@/contexts/clinical-records/domain/repositories/ReportSignatureRequestRepository';
import type {
  ProfessionalIdentity,
  ProfessionalIdentityReader,
} from '@/contexts/clinical-records/domain/repositories/ProfessionalIdentityReader';
import { RequestReportSignature, type SupervisionChecker } from '@/contexts/clinical-records/application/report-signature/RequestReportSignature';
import { SignRequestedReport } from '@/contexts/clinical-records/application/report-signature/SignRequestedReport';
import { RejectSignatureRequest } from '@/contexts/clinical-records/application/report-signature/RejectSignatureRequest';
import { CancelSignatureRequest } from '@/contexts/clinical-records/application/report-signature/CancelSignatureRequest';
import { IssueSupervisorCertificate } from '@/contexts/clinical-records/application/report-signature/IssueSupervisorCertificate';
import { ProfessionalLicenseRequiredError } from '@/contexts/clinical-records/domain/errors/ProfessionalLicenseRequiredError';
import { SignatureRequestNotFoundError } from '@/contexts/clinical-records/domain/errors/SignatureRequestNotFoundError';

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

class InMemoryRequests implements ReportSignatureRequestRepository {
  public readonly items: ReportSignatureRequest[] = [];
  public async save(request: ReportSignatureRequest): Promise<void> {
    const i = this.items.findIndex((r) => r.requestId() === request.requestId());
    if (i >= 0) this.items[i] = request;
    else this.items.push(request);
  }
  public async findById(id: string): Promise<ReportSignatureRequest | null> {
    return this.items.find((r) => r.requestId() === id) ?? null;
  }
  public async findPendingByReport(reportId: string): Promise<ReportSignatureRequest | null> {
    return this.items.find((r) => r.forReport(reportId) && r.isPending()) ?? null;
  }
  public async listPendingForSupervisor(supervisorUserId: string): Promise<ReportSignatureRequest[]> {
    return this.items.filter((r) => r.addressedTo(supervisorUserId) && r.isPending());
  }
}

/** Supervisión configurable: el set contiene pares "supervisor>supervisado". */
function checker(active: Set<string>): SupervisionChecker {
  return { supervises: (sup, sub) => Promise.resolve(active.has(`${sup}>${sub}`)) };
}

function identity(license: string): ProfessionalIdentityReader {
  const id: ProfessionalIdentity = {
    fullName: 'Dra. Supervisora',
    professionalLicense: license,
    email: 's@e.test',
    contactPhone: '',
    contactAddress: '',
    organizationName: null,
    organizationLogoDataUri: null,
  };
  return { read: () => Promise.resolve(id) };
}

/** Reporte del practicante, ya REVISADO (listo para firma). */
function reviewedReport(id = 'rep-1', patientId = 'pac-1'): PatientReport {
  const report = PatientReport.draft({ id, patientId, kind: 'informe_clinico', title: 'Informe', content: 'x' });
  report.edit({ title: 'Informe', content: 'Contenido revisado', reviewed: true });
  return report;
}

const ORG = 'org-1';
const STUDENT = 'estudiante-1';
const SUPERVISOR = 'profe-1';

describe('ReportSignatureRequest (dominio)', () => {
  it('nace pendiente y, firmada, no admite otra transición', () => {
    const req = ReportSignatureRequest.open({
      id: 'q1',
      reportId: 'rep-1',
      patientId: 'pac-1',
      requesterUserId: STUDENT,
      supervisorUserId: SUPERVISOR,
      organizationId: ORG,
      note: 'porfa',
    });
    expect(req.isPending()).toBe(true);
    req.markSigned();
    expect(req.toPrimitives().status).toBe('firmado');
    expect(() => req.reject('no')).toThrow(SignatureRequestAlreadyResolvedError);
    expect(() => req.cancel()).toThrow(SignatureRequestAlreadyResolvedError);
  });
});

describe('RequestReportSignature (el practicante pide)', () => {
  async function setup() {
    const reports = new InMemoryReports();
    await reports.save(reviewedReport());
    const requests = new InMemoryRequests();
    return { reports, requests };
  }

  it('abre la solicitud si el reporte está revisado y el supervisor es activo', async () => {
    const { reports, requests } = await setup();
    const useCase = new RequestReportSignature(requests, reports, checker(new Set([`${SUPERVISOR}>${STUDENT}`])));
    const id = await useCase.execute({
      reportId: 'rep-1',
      patientId: 'pac-1',
      requesterUserId: STUDENT,
      supervisorUserId: SUPERVISOR,
      organizationId: ORG,
      note: 'porfa',
    });
    expect((await requests.findById(id))!.isPending()).toBe(true);
  });

  it('RECHAZA si el reporte no está revisado', async () => {
    const reports = new InMemoryReports();
    await reports.save(PatientReport.draft({ id: 'rep-1', patientId: 'pac-1', kind: 'informe_clinico', title: 'x', content: 'x' }));
    const requests = new InMemoryRequests();
    const useCase = new RequestReportSignature(requests, reports, checker(new Set([`${SUPERVISOR}>${STUDENT}`])));
    await expect(
      useCase.execute({ reportId: 'rep-1', patientId: 'pac-1', requesterUserId: STUDENT, supervisorUserId: SUPERVISOR, organizationId: ORG, note: '' }),
    ).rejects.toThrow();
  });

  it('RECHAZA si el supervisor elegido no supervisa al practicante', async () => {
    const { reports, requests } = await setup();
    const useCase = new RequestReportSignature(requests, reports, checker(new Set())); // nadie supervisa
    await expect(
      useCase.execute({ reportId: 'rep-1', patientId: 'pac-1', requesterUserId: STUDENT, supervisorUserId: SUPERVISOR, organizationId: ORG, note: '' }),
    ).rejects.toThrow();
  });

  it('RECHAZA una segunda solicitud pendiente para el mismo reporte', async () => {
    const { reports, requests } = await setup();
    const useCase = new RequestReportSignature(requests, reports, checker(new Set([`${SUPERVISOR}>${STUDENT}`])));
    const input = { reportId: 'rep-1', patientId: 'pac-1', requesterUserId: STUDENT, supervisorUserId: SUPERVISOR, organizationId: ORG, note: '' };
    await useCase.execute(input);
    await expect(useCase.execute(input)).rejects.toThrow();
  });
});

describe('SignRequestedReport (el supervisor firma — cross-owner gateado)', () => {
  async function setup(license = 'TP-9') {
    const studentReports = new InMemoryReports();
    await studentReports.save(reviewedReport());
    const requests = new InMemoryRequests();
    const request = ReportSignatureRequest.open({
      id: 'q1', reportId: 'rep-1', patientId: 'pac-1', requesterUserId: STUDENT, supervisorUserId: SUPERVISOR, organizationId: ORG, note: '',
    });
    await requests.save(request);
    const useCase = new SignRequestedReport(
      requests,
      (owner) => (owner === STUDENT ? studentReports : new InMemoryReports()),
      () => identity(license),
      checker(new Set([`${SUPERVISOR}>${STUDENT}`])),
    );
    return { studentReports, requests, useCase };
  }

  it('firma el reporte DEL PRACTICANTE con la identidad del supervisor (no repudio)', async () => {
    const { studentReports, requests, useCase } = await setup();
    await useCase.execute({ requestId: 'q1', supervisorUserId: SUPERVISOR });

    const report = (await studentReports.findById('rep-1'))!.toPrimitives();
    expect(report.status).toBe('firmado');
    expect(report.signedBy).toBe('Dra. Supervisora');
    expect(report.licenseNumber).toBe('TP-9');
    expect(report.signedByUserId).toBe(SUPERVISOR); // firmó el supervisor, no el estudiante
    expect((await requests.findById('q1'))!.toPrimitives().status).toBe('firmado');
  });

  it('RECHAZA si el vínculo de supervisión ya no está activo (revocado/baja)', async () => {
    const studentReports = new InMemoryReports();
    await studentReports.save(reviewedReport());
    const requests = new InMemoryRequests();
    await requests.save(ReportSignatureRequest.open({ id: 'q1', reportId: 'rep-1', patientId: 'pac-1', requesterUserId: STUDENT, supervisorUserId: SUPERVISOR, organizationId: ORG, note: '' }));
    const useCase = new SignRequestedReport(
      requests,
      () => studentReports,
      () => identity('TP-9'),
      checker(new Set()), // ya no supervisa
    );
    await expect(useCase.execute({ requestId: 'q1', supervisorUserId: SUPERVISOR })).rejects.toThrow();
    expect((await studentReports.findById('rep-1'))!.toPrimitives().status).toBe('revisado'); // no se firmó
  });

  it('RECHAZA si el supervisor no tiene tarjeta profesional', async () => {
    const { studentReports, useCase } = await setup('');
    await expect(useCase.execute({ requestId: 'q1', supervisorUserId: SUPERVISOR })).rejects.toThrow(
      ProfessionalLicenseRequiredError,
    );
    expect((await studentReports.findById('rep-1'))!.toPrimitives().status).toBe('revisado');
  });

  it('RECHAZA si la solicitud no está dirigida a ese supervisor', async () => {
    const { useCase } = await setup();
    await expect(useCase.execute({ requestId: 'q1', supervisorUserId: 'otro-profe' })).rejects.toThrow(
      SignatureRequestNotFoundError,
    );
  });
});

describe('Reject/Cancel SignatureRequest', () => {
  async function pendingRequest() {
    const requests = new InMemoryRequests();
    await requests.save(ReportSignatureRequest.open({ id: 'q1', reportId: 'rep-1', patientId: 'pac-1', requesterUserId: STUDENT, supervisorUserId: SUPERVISOR, organizationId: ORG, note: '' }));
    return requests;
  }

  it('el supervisor rechaza con motivo', async () => {
    const requests = await pendingRequest();
    await new RejectSignatureRequest(requests, checker(new Set([`${SUPERVISOR}>${STUDENT}`]))).execute({
      requestId: 'q1',
      supervisorUserId: SUPERVISOR,
      reason: 'falta info',
    });
    const p = (await requests.findById('q1'))!.toPrimitives();
    expect(p.status).toBe('rechazado');
    expect(p.resolutionNote).toBe('falta info');
  });

  it('RECHAZAR exige vínculo vigente: un ex-supervisor no puede cerrar la solicitud', async () => {
    const requests = await pendingRequest();
    await expect(
      new RejectSignatureRequest(requests, checker(new Set())).execute({
        requestId: 'q1',
        supervisorUserId: SUPERVISOR,
        reason: 'x',
      }),
    ).rejects.toThrow(SignatureRequestNotFoundError);
    expect((await requests.findById('q1'))!.isPending()).toBe(true);
  });

  it('el practicante cancela la suya', async () => {
    const requests = await pendingRequest();
    await new CancelSignatureRequest(requests).execute({ requestId: 'q1', requesterUserId: STUDENT });
    expect((await requests.findById('q1'))!.toPrimitives().status).toBe('cancelado');
  });

  it('un tercero no puede cancelar la solicitud de otro', async () => {
    const requests = await pendingRequest();
    await expect(new CancelSignatureRequest(requests).execute({ requestId: 'q1', requesterUserId: 'otro' })).rejects.toThrow(
      SignatureRequestNotFoundError,
    );
  });
});

describe('IssueSupervisorCertificate (certificado propio del docente)', () => {
  it('crea un borrador de constancia propiedad del docente, referido al paciente', async () => {
    const reports = new InMemoryReports(); // repo del DOCENTE en producción
    const id = await new IssueSupervisorCertificate(reports).execute({
      patientId: 'pac-1',
      patientName: 'Ana Pérez',
      supervisedName: 'Estudiante X',
    });
    const cert = (await reports.findById(id))!.toPrimitives();
    expect(cert.kind).toBe('constancia_atencion');
    expect(cert.status).toBe('borrador'); // se firma luego con la tarjeta del docente
    expect(cert.patientId).toBe('pac-1');
    expect(cert.content).toContain('Ana Pérez');
    expect(cert.content).toContain('Estudiante X');
    expect(cert.signedByUserId).toBe(''); // aún sin firmar
  });
});
