/**
 * Preferencia de tema visual de correo del profesional
 * (practitioner_profile.email_theme). Los temas viven en
 * `src/shared/infrastructure/email-themes/emailThemes.ts`.
 */
export interface EmailThemeStore {
  current(): Promise<string>;
  save(theme: string): Promise<void>;
}
