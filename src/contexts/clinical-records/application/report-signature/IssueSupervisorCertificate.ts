import { randomUUID } from 'node:crypto';
import { PatientReport } from '../../domain/PatientReport';
import type { PatientReportRepository } from '../../domain/repositories/PatientReportRepository';

/**
 * El docente emite SU PROPIO certificado sobre el paciente de un supervisado: un
 * reporte de constancia que PERTENECE al docente (owner = docente) y referencia al
 * paciente. El docente lo edita y lo firma con SU tarjeta (flujo de firma normal, 3·B1),
 * de modo que el documento queda a su nombre — la institución nunca firma por él.
 *
 * El acceso al paciente del supervisado se gatea ARRIBA (vínculo de supervisión activo
 * o custodia, trazado); este caso de uso solo crea el borrador propiedad del docente.
 */
export class IssueSupervisorCertificate {
  public constructor(private readonly reports: PatientReportRepository) {}

  public async execute(input: {
    patientId: string;
    patientName: string;
    supervisedName?: string;
  }): Promise<string> {
    const patientName = input.patientName.trim();
    const supervisedName = (input.supervisedName ?? '').trim();
    // El "marco" cambia según haya un estudiante vigente o el expediente esté en
    // custodia institucional (el estudiante se retiró y la institución lo retuvo).
    const marco = supervisedName
      ? `en el marco de la supervisión de ${supervisedName}`
      : `como supervisor del proceso, sobre un expediente bajo custodia de la institución`;
    const report = PatientReport.draft({
      id: randomUUID(),
      patientId: input.patientId,
      kind: 'constancia_atencion',
      // El nombre del paciente va en el título (además del cuerpo) porque el PDF lo
      // imprime como encabezado; así el documento queda identificado aunque la línea
      // "Paciente:" del PDF —que se resuelve por dueño— quede vacía para este caso.
      title: patientName ? `Constancia de atención — ${patientName}` : 'Constancia de atención',
      content:
        `Por medio de la presente, en mi calidad de supervisor del proceso, dejo constancia de la ` +
        `atención psicológica brindada a ${input.patientName} ${marco}.\n\n[Detalla aquí lo que ` +
        `certificas: periodo, naturaleza del proceso, propósito de la constancia. Revisa y edita ` +
        `antes de firmar.]`,
    });
    await this.reports.save(report);
    return report.reportId();
  }
}
