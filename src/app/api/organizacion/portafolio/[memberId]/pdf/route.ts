import type { NextRequest } from 'next/server';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import { SqlitePortfolioReader } from '@/contexts/patients/infrastructure/persistence/SqlitePortfolioReader';
import { buildPortfolioMarkdown } from '@/contexts/patients/domain/portfolio';
import { renderPortfolioPdfHtml } from '@/contexts/patients/infrastructure/pdf/portfolioPdfHtml';
import { logRecordAccess } from '@/shared/infrastructure/audit/recordAccessLog';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

// Portafolio pseudonimizado (§3.4): PDF del trabajo clínico propio del miembro, sin
// identificar a los pacientes. Solo el maestro de la organización; trazado en bitácora.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
): Promise<Response> {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autenticado.', { status: 401 });
  if (context.role !== 'org_master' || !context.organization) {
    return new Response('Solo el maestro de la organización puede exportar portafolios.', { status: 403 });
  }
  const userId = context.userId;
  const organizationId = context.organization.id;
  const { memberId } = await params;

  // El miembro debe pertenecer a ESTA organización (aislamiento).
  const isMember = await getDatabaseAdapter().queryRow(
    'SELECT 1 AS hit FROM organization_memberships WHERE organization_id = ? AND user_id = ?',
    [organizationId, memberId],
  );
  if (!isMember) return new Response('El miembro no pertenece a la organización.', { status: 404 });

  const reader = new SqlitePortfolioReader();
  const cases = await reader.build(organizationId, memberId);
  const professional = (await getDatabaseAdapter().queryRow(
    'SELECT full_name FROM practitioner_profile WHERE user_id = ?',
    [memberId],
  )) as { full_name?: string } | null;

  const markdown = buildPortfolioMarkdown({
    generatedAt: new Date().toISOString(),
    professionalName: professional?.full_name ?? '',
    organizationName: context.organization.name,
    cases,
  });
  const html = renderPortfolioPdfHtml(markdown);

  // Traza: el export tocó estos expedientes (habeas data). Acción dedicada.
  for (const patientId of await reader.casePatientIds(organizationId, memberId)) {
    await logRecordAccess(userId, patientId, 'exportar', 'exportar_portafolio');
  }

  if (isDesktopEdition()) {
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

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
          'Content-Disposition': 'attachment; filename="portafolio-pseudonimizado.pdf"',
          'Cache-Control': 'no-store',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(`No se pudo generar el PDF (motor de impresión no disponible): ${message}.`, {
      status: 500,
    });
  }
}
