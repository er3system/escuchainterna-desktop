import type { NextRequest } from 'next/server';
import { SqlitePatientReportRepository } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientReportRepository';
import { SqlitePatientDirectory } from '@/contexts/clinical-records/infrastructure/persistence/SqlitePatientDirectory';
import { SqliteProfessionalIdentityReader } from '@/contexts/clinical-records/infrastructure/persistence/SqliteProfessionalIdentityReader';
import { renderReportPdfHtml } from '@/contexts/clinical-records/infrastructure/pdf/reportPdfHtml';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { auditCustodyAccess } from '@/shared/infrastructure/auth/institutionalCustody';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

// Genera el PDF en el servidor con Playwright (chromium): siempre dinámico y en
// runtime Node (no edge). Acotado por owner_user_id; el borrador lleva marca de agua.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'reporte'
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string }> },
): Promise<Response> {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autorizado.', { status: 401 });
  if (context.isAssistant || context.role === 'professor') {
    return new Response('No autorizado.', { status: 403 });
  }
  const ownerUserId = context.userId;
  const { id, reportId } = await params;

  const report = await new SqlitePatientReportRepository(ownerUserId).findById(reportId);
  if (!report || !report.belongsTo(id)) {
    return new Response('Reporte no encontrado.', { status: 404 });
  }
  if (isDesktopEdition()) {
    return new Response('En la edición de PC, abre el reporte y pulsa «Guardar PDF» o usa Archivo → Guardar PDF. El archivo se genera en esta PC.', { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  // Custodia institucional (§3.3): descargar el expediente de un paciente retenido es
  // un acceso de ruptura de cristal y debe quedar trazado (no pasa por el layout).
  await auditCustodyAccess(ownerUserId, id, 'exportar');
  const primitives = report.toPrimitives();
  const patient = await new SqlitePatientDirectory(ownerUserId).findSummary(id);
  const professional = await new SqliteProfessionalIdentityReader(ownerUserId).read();

  const html = renderReportPdfHtml({
    report: primitives,
    patientName: patient?.fullName ?? '',
    professional: professional ?? null,
  });

  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '15mm', right: '15mm' },
      });
      return new Response(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${slug(primitives.title)}.pdf"`,
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      `No se pudo generar el PDF (motor de impresión no disponible): ${message}. Usa «Imprimir» como alternativa.`,
      { status: 500 },
    );
  }
}
