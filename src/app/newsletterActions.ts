'use server';

import { subscribeToNewsletter } from '@/shared/infrastructure/newsletter/NewsletterSubscribers';

export interface NewsletterState {
  done?: boolean;
  error?: string;
}

/**
 * Suscripción al boletín de pre-lanzamiento desde el banner de la landing.
 * Público y anónimo. El campo "empresa" es un honeypot: los humanos no lo ven
 * (está oculto), los bots lo rellenan → se responde éxito SIN guardar nada.
 * Un correo duplicado también responde éxito (no se revela si ya existía).
 */
export async function subscribeNewsletterAction(
  _prev: NewsletterState,
  formData: FormData,
): Promise<NewsletterState> {
  const honeypot = String(formData.get('empresa') ?? '');
  if (honeypot) return { done: true };

  const email = String(formData.get('email') ?? '');
  try {
    const result = await subscribeToNewsletter(email);
    if (!result.ok) return { error: 'Escribe un correo válido, por ejemplo tu@correo.com.' };
    return { done: true };
  } catch {
    return { error: 'No pudimos guardar tu correo. Inténtalo de nuevo en un momento.' };
  }
}
