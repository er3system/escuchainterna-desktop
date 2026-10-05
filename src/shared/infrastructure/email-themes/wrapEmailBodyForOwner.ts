import { isThemedEmailBody, renderEmailTheme } from './emailThemes';
import { resolveEmailSender } from './resolveEmailSender';

/**
 * Envuelve el cuerpo (texto plano) de un correo en el tema visual elegido por
 * el profesional, con su nombre como remitente visual y el logo de su
 * organización si la tiene. Es tolerante a fallos: ante cualquier problema
 * devuelve el cuerpo original (un correo nunca se pierde por el tema).
 */
export async function wrapEmailBodyForOwner(ownerUserId: string, body: string): Promise<string> {
  if (isThemedEmailBody(body)) return body;
  try {
    const { theme, sender } = await resolveEmailSender(ownerUserId);
    return renderEmailTheme(theme, body, sender);
  } catch {
    return body;
  }
}
