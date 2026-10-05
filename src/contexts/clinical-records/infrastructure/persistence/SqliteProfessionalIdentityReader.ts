import { existsSync, readFileSync } from 'node:fs';
import { extname, isAbsolute, join } from 'node:path';
import type { DatabaseAdapter } from '@/shared/infrastructure/persistence/DatabaseAdapter';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
import type {
  ProfessionalIdentity,
  ProfessionalIdentityReader,
} from '../../domain/repositories/ProfessionalIdentityReader';

interface IdentityRow {
  email: string;
  full_name: string;
  professional_license: string;
  phone: string;
  contact_phone: string;
  phone_country_code: string;
  address: string;
  contact_address: string;
  organization_name: string | null;
  organization_logo_path: string | null;
}

const LOGO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

function logoAsDataUri(logoPath: string | null): string | null {
  if (!logoPath) return null;
  const absolute = isAbsolute(logoPath) ? logoPath : join(process.cwd(), logoPath);
  if (!existsSync(absolute)) return null;
  const mime = LOGO_MIME[extname(absolute).toLowerCase()];
  if (!mime) return null;
  try {
    return `data:${mime};base64,${readFileSync(absolute).toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Encabezado del profesional para exportables y reportes firmados (spec v2
 * §6.8): nombre, cédula, contacto y logo de su organización (como data URI,
 * apto para la vista de impresión sin servir archivos).
 */
export class SqliteProfessionalIdentityReader implements ProfessionalIdentityReader {
  public constructor(
    private readonly ownerUserId: string,
    private readonly db: DatabaseAdapter = getDatabaseAdapter(),
  ) {}

  public async read(): Promise<ProfessionalIdentity | null> {
    const row = await this.db.queryRow<IdentityRow>(
      `SELECT u.email, p.full_name, p.professional_license, p.phone, p.contact_phone,
                p.phone_country_code, p.address, p.contact_address,
                o.name AS organization_name, o.logo_path AS organization_logo_path
         FROM users u
         JOIN practitioner_profile p ON p.user_id = u.id
         LEFT JOIN organization_memberships m ON m.user_id = u.id
         LEFT JOIN organizations o ON o.id = m.organization_id
         WHERE u.id = ?
         LIMIT 1`,
      [this.ownerUserId],
    );
    if (!row) return null;

    const rawPhone = row.contact_phone.trim() !== '' ? row.contact_phone.trim() : row.phone.trim();
    const contactPhone =
      rawPhone === ''
        ? ''
        : rawPhone.startsWith('+')
          ? rawPhone
          : `${row.phone_country_code} ${rawPhone}`.trim();

    return {
      fullName: row.full_name,
      professionalLicense: row.professional_license,
      email: row.email,
      contactPhone,
      contactAddress: row.contact_address.trim() !== '' ? row.contact_address : row.address,
      organizationName: row.organization_name,
      organizationLogoDataUri: logoAsDataUri(row.organization_logo_path),
    };
  }
}
