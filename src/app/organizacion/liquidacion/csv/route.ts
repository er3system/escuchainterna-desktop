import { format } from 'date-fns';
import { requireOrgMaster, getOrgLiquidation } from '../../orgData';

/**
 * Exportación CSV de la liquidación interna informativa (v3 §3).
 * GET /organizacion/liquidacion/csv?mes=AAAA-MM — protegido por el guard del
 * maestro de organización (igual que la página).
 */

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",;\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const ROLE_LABELS: Record<string, string> = {
  master: 'Perfil maestro',
  professor: 'Profesor/a',
  psychologist: 'Psicólogo/a',
};

export async function GET(request: Request): Promise<Response> {
  const { organization } = await requireOrgMaster();
  const url = new URL(request.url);
  const rawMonth = url.searchParams.get('mes') ?? '';
  const month = MONTH_PATTERN.test(rawMonth) ? rawMonth : format(new Date(), 'yyyy-MM');

  const liquidation = await getOrgLiquidation(organization.id, month);

  const lines: string[] = [
    [
      'miembro',
      'correo',
      'rol',
      'moneda',
      'sesiones_cobradas',
      'total_cobrado',
      'porcentaje_liquidacion_interna',
      'monto_organizacion_informativo',
    ].join(','),
  ];

  for (const member of liquidation.members) {
    if (member.totals.length === 0) {
      lines.push(
        [
          csvCell(member.fullName || member.email),
          csvCell(member.email),
          csvCell(ROLE_LABELS[member.memberRole] ?? member.memberRole),
          '',
          '0',
          '0',
          csvCell(member.liquidationPercent),
          '0',
        ].join(','),
      );
      continue;
    }
    for (const total of member.totals) {
      lines.push(
        [
          csvCell(member.fullName || member.email),
          csvCell(member.email),
          csvCell(ROLE_LABELS[member.memberRole] ?? member.memberRole),
          csvCell(total.currency),
          csvCell(total.paidSessions),
          csvCell(total.totalCharged.toFixed(2)),
          csvCell(member.liquidationPercent),
          csvCell(total.organizationShare.toFixed(2)),
        ].join(','),
      );
    }
  }

  for (const total of liquidation.totalsByCurrency) {
    lines.push(
      [
        csvCell('TOTAL DEL EQUIPO'),
        '',
        '',
        csvCell(total.currency),
        csvCell(total.paidSessions),
        csvCell(total.totalCharged.toFixed(2)),
        '',
        csvCell(total.organizationShare.toFixed(2)),
      ].join(','),
    );
  }

  // BOM para que Excel abra el archivo como UTF-8.
  const csv = String.fromCharCode(0xfeff) + lines.join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="liquidacion-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
