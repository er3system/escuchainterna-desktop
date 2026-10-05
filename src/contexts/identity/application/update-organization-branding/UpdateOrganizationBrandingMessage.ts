import { InvalidOrganizationSlugError } from './InvalidOrganizationSlugError';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Ajustes de la organización editables por su maestro: slug (futuro
 * subdominio), ruta del logo y servicio sin costo (v3 §3, universidades).
 * Los campos no provistos (undefined) se dejan como están.
 */
export class UpdateOrganizationBrandingMessage {
  private readonly normalizedSlug?: string;

  public constructor(
    private readonly input: {
      organizationId: string;
      actorUserId: string;
      slug?: string;
      logoPath?: string | null;
      freeService?: boolean;
    },
  ) {
    if (input.slug !== undefined) {
      const slug = input.slug.trim().toLowerCase();
      if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
        throw new InvalidOrganizationSlugError(input.slug);
      }
      this.normalizedSlug = slug;
    }
  }

  public organizationId(): string {
    return this.input.organizationId;
  }

  public actorUserId(): string {
    return this.input.actorUserId;
  }

  public slug(): string | undefined {
    return this.normalizedSlug;
  }

  /** undefined = no tocar; null = quitar logo; string = nueva ruta relativa. */
  public logoPath(): string | null | undefined {
    return this.input.logoPath;
  }

  /** undefined = no tocar el servicio sin costo. */
  public freeService(): boolean | undefined {
    return this.input.freeService;
  }
}
