import type { PatientReportPrimitives } from '../../domain/PatientReport';
import { PATIENT_REPORT_KIND_LABELS } from '../../domain/value-objects/patientReportKinds';
import {
  escapeClinicalHtml as escapeHtml,
  renderClinicalMarkdownToHtml,
} from '../../domain/clinicalMarkdown';

/** Datos del profesional para el encabezado del documento (igual que ReportEditor). */
export interface ReportPdfProfessional {
  fullName: string;
  professionalLicense: string;
  email: string;
  contactPhone: string;
  contactAddress: string;
  organizationName: string | null;
  organizationLogoDataUri: string | null;
}

function fmtDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * HTML imprimible del reporte para generar el PDF con Playwright (page.setContent).
 * Documento autónomo (estilos en línea): encabezado del profesional, cuerpo del
 * reporte (markdown ligero), firma o marca de agua BORRADOR. PURO y testable.
 */
export function renderReportPdfHtml(input: {
  report: PatientReportPrimitives;
  patientName: string;
  professional: ReportPdfProfessional | null;
}): string {
  const { report, patientName, professional } = input;
  const isSigned = report.status === 'firmado';
  const kindLabel = PATIENT_REPORT_KIND_LABELS[report.kind];
  const body = renderClinicalMarkdownToHtml(report.content);

  const contactLine = professional
    ? [professional.contactPhone, professional.email].filter((value) => value).join(' · ')
    : '';

  const logo =
    professional?.organizationLogoDataUri
      ? `<img class="logo" src="${professional.organizationLogoDataUri}" alt="Logo" />`
      : '';

  const professionalBlock = professional
    ? `<div class="prof">
         <p class="prof-name">${escapeHtml(professional.fullName || '—')}</p>
         ${professional.professionalLicense ? `<p>Cédula / tarjeta profesional: ${escapeHtml(professional.professionalLicense)}</p>` : ''}
         ${contactLine ? `<p>${escapeHtml(contactLine)}</p>` : ''}
         ${professional.contactAddress ? `<p>${escapeHtml(professional.contactAddress)}</p>` : ''}
         ${professional.organizationName ? `<p>${escapeHtml(professional.organizationName)}</p>` : ''}
       </div>`
    : '';

  const footer = isSigned && report.signedAt
    ? `<div class="sign">
         <p class="sign-name">${escapeHtml(report.signedBy)}</p>
         <p>Cédula / tarjeta profesional: ${escapeHtml(report.licenseNumber)}</p>
         <p>Firmado el ${escapeHtml(fmtDateTime(report.signedAt))}</p>
       </div>`
    : `<p class="draft-footer">DOCUMENTO EN BORRADOR — sin validez hasta su revisión y firma profesional.</p>`;

  const watermark = isSigned ? '' : '<div class="watermark">BORRADOR</div>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.55; }
  .watermark { position: fixed; top: 45%; left: 0; right: 0; text-align: center; transform: rotate(-30deg); font-size: 96px; font-weight: 900; letter-spacing: 8px; color: #d22; opacity: 0.12; z-index: 0; }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
  .kind { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #666; }
  .prof { margin-top: 6px; }
  .prof p { margin: 0; color: #555; }
  .prof-name { font-weight: 700; color: #1a1a1a; }
  .logo { height: 56px; width: auto; object-fit: contain; }
  h1.title { font-size: 18px; margin: 10px 0 2px; }
  .patient { color: #555; margin: 0 0 4px; }
  .content { position: relative; z-index: 1; }
  .content h1 { font-size: 17px; margin: 16px 0 8px; }
  .content h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .content h3 { font-size: 12.5px; margin: 12px 0 4px; }
  .content p { margin: 5px 0; }
  .content ul { margin: 5px 0; padding-left: 20px; }
  .content li { margin: 2px 0; }
  .content blockquote { margin: 6px 0; padding: 2px 0 2px 10px; border-left: 3px solid #ddd; color: #555; font-style: italic; }
  footer { margin-top: 36px; border-top: 1px solid #ccc; padding-top: 12px; }
  .sign-name { font-weight: 700; margin: 0; }
  .sign p { margin: 0; color: #555; }
  .draft-footer { font-weight: 700; color: #d22; }
</style>
</head>
<body>
  ${watermark}
  <header>
    <div>
      <p class="kind">${escapeHtml(kindLabel)}</p>
      ${professionalBlock}
    </div>
    ${logo}
  </header>
  <h1 class="title">${escapeHtml(report.title)}</h1>
  <p class="patient">Paciente: ${escapeHtml(patientName)}</p>
  <div class="content">${body}</div>
  <footer>${footer}</footer>
</body>
</html>`;
}
