import { requireAdmin } from '../../requireAdmin';
import { listNewsletterSubscribers } from '@/shared/infrastructure/newsletter/NewsletterSubscribers';

/**
 * Export CSV de los suscriptores del boletín de pre-lanzamiento.
 * GET /admin/boletin/csv — el layout NO cubre route handlers, así que el guard
 * de admin se aplica aquí explícitamente (mismo patrón que liquidacion/csv).
 */

function csvCell(value: string): string {
  return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(): Promise<Response> {
  await requireAdmin();

  const subscribers = await listNewsletterSubscribers();
  const lines = ['correo,origen,fecha_suscripcion'];
  for (const subscriber of subscribers) {
    lines.push(
      [csvCell(subscriber.email), csvCell(subscriber.source), csvCell(subscriber.createdAt)].join(
        ',',
      ),
    );
  }

  // BOM para que Excel abra el archivo como UTF-8.
  const csv = String.fromCharCode(0xfeff) + lines.join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="boletin-prelanzamiento.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
