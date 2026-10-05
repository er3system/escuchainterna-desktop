import { Download, Mail } from 'lucide-react';
import {
  countNewsletterSubscribers,
  listNewsletterSubscribers,
} from '@/shared/infrastructure/newsletter/NewsletterSubscribers';

export const metadata = { title: 'Boletín · Admin · EscuchaInterna' };

const SOURCE_LABELS: Record<string, string> = {
  banner_prelanzamiento: 'Banner de la landing',
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Correos capturados por el banner de pre-lanzamiento. Solo lectura + export
 * CSV: la lista ES el activo (audiencia del anuncio de lanzamiento).
 * El guard de admin lo aplica el layout de /admin.
 */
export default async function AdminBoletinPage() {
  const [subscribers, total] = await Promise.all([
    listNewsletterSubscribers(),
    countNewsletterSubscribers(),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
            <Mail size={22} />
            Boletín de pre-lanzamiento
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total === 0
              ? 'Aún no hay suscriptores.'
              : `${total} ${total === 1 ? 'persona suscrita' : 'personas suscritas'} al aviso de avances.`}
          </p>
        </div>
        {total > 0 && (
          <a
            href="/admin/boletin/csv"
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <Download size={16} />
            Exportar CSV
          </a>
        )}
      </div>

      {total > 0 && (
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <tr>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Origen</th>
                <th className="px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr key={subscriber.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-3 font-medium text-ink">{subscriber.email}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {SOURCE_LABELS[subscriber.source] ?? subscriber.source}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{formatDate(subscriber.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
