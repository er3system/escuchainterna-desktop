import fs from 'node:fs';
import path from 'node:path';
import { getDatabaseAdapter } from '../persistence/SqliteAdapter';
import {
  DEFAULT_EMAIL_THEME,
  isEmailThemeId,
  type EmailSenderData,
  type EmailThemeId,
} from './emailThemes';

interface ProfileRow {
  full_name: string;
  email_theme: string;
}

interface OrgRow {
  name: string;
  logo_path: string | null;
}

const LOGO_MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

/** Logo de la org como data URI (los correos locales no pueden referenciar archivos del disco). */
function logoDataUri(logoPath: string): string | undefined {
  try {
    const absolute = path.isAbsolute(logoPath) ? logoPath : path.resolve(process.cwd(), logoPath);
    const mime = LOGO_MIME_BY_EXTENSION[path.extname(absolute).toLowerCase()];
    if (!mime) return undefined;
    const stat = fs.statSync(absolute);
    if (stat.size > 512 * 1024) return undefined; // no inflar el outbox con logos enormes
    return `data:${mime};base64,${fs.readFileSync(absolute).toString('base64')}`;
  } catch {
    return undefined;
  }
}

export interface ResolvedEmailSender {
  theme: EmailThemeId;
  sender: EmailSenderData;
}

/**
 * Resuelve el tema de correo y el branding del profesional (nombre, nombre y
 * logo de su organización) desde la BD. Fuente única usada tanto por el
 * envoltorio del outbox como por las vistas previas de la UI, para que la
 * preview muestre exactamente lo que recibirán los pacientes.
 *
 * Tolerante a fallos: ante cualquier problema devuelve el tema por defecto y un
 * remitente genérico (un correo nunca se pierde por el branding).
 */
export async function resolveEmailSender(ownerUserId: string): Promise<ResolvedEmailSender> {
  try {
    const db = getDatabaseAdapter();
    const profile = await db.queryRow<ProfileRow>(
      'SELECT full_name, email_theme FROM practitioner_profile WHERE user_id = ?',
      [ownerUserId],
    );
    const org = await db.queryRow<OrgRow>(
      `SELECT o.name, o.logo_path
           FROM organization_memberships m
           JOIN organizations o ON o.id = m.organization_id
          WHERE m.user_id = ?
          ORDER BY m.created_at ASC LIMIT 1`,
      [ownerUserId],
    );

    const theme: EmailThemeId =
      profile && isEmailThemeId(profile.email_theme) ? profile.email_theme : DEFAULT_EMAIL_THEME;

    return {
      theme,
      sender: {
        professionalName: profile?.full_name?.trim() || 'Tu profesional',
        organizationName: org?.name?.trim() || undefined,
        organizationLogoUrl: org?.logo_path ? logoDataUri(org.logo_path) : undefined,
      },
    };
  } catch {
    return {
      theme: DEFAULT_EMAIL_THEME,
      sender: { professionalName: 'Tu profesional' },
    };
  }
}
