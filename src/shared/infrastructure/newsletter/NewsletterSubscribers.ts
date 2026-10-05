import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';

/**
 * Boletín de pre-lanzamiento: correos que los visitantes dejan en el banner
 * "sitio en desarrollo" de la landing. Dato de marketing global (visitante
 * anónimo, sin tenant) y no clínico. La suscripción repetida es idempotente
 * (UNIQUE en email + ON CONFLICT DO NOTHING) y NO se revela si el correo ya
 * estaba suscrito.
 */

/** Formato razonable de correo; el límite de 254 es el máximo práctico de RFC. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MAX_EMAIL_LENGTH = 254;

export interface NewsletterSubscriber {
  id: string;
  email: string;
  source: string;
  createdAt: string;
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidNewsletterEmail(email: string): boolean {
  const value = normalize(email);
  return value.length > 0 && value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
}

/**
 * Suscribe un correo al boletín. Devuelve ok:false solo ante formato inválido;
 * un duplicado devuelve ok:true (idempotente, sin revelar que ya existía).
 */
export async function subscribeToNewsletter(
  email: string,
  source = 'banner_prelanzamiento',
): Promise<{ ok: boolean }> {
  if (!isValidNewsletterEmail(email)) return { ok: false };
  await getDatabaseAdapter().execute(
    `INSERT INTO newsletter_subscribers (id, email, source, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO NOTHING`,
    [randomUUID(), normalize(email), source, new Date().toISOString()],
  );
  return { ok: true };
}

interface SubscriberRow {
  id: string;
  email: string;
  source: string;
  created_at: string;
}

/** Suscriptores más recientes primero (para /admin/boletin y su CSV). */
export async function listNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const rows = await getDatabaseAdapter().query<SubscriberRow>(
    `SELECT id, email, source, created_at
       FROM newsletter_subscribers
      ORDER BY created_at DESC, id DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    source: row.source,
    createdAt: row.created_at,
  }));
}

export async function countNewsletterSubscribers(): Promise<number> {
  const row = await getDatabaseAdapter().queryRow<{ total: number }>(
    'SELECT COUNT(*) AS total FROM newsletter_subscribers',
  );
  return Number(row?.total ?? 0);
}
