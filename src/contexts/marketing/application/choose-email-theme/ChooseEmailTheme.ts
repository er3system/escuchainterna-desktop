import { isEmailThemeId } from '@/shared/infrastructure/email-themes/emailThemes';
import { InvalidEmailThemeError } from '../../domain/errors/InvalidEmailThemeError';
import { EmailThemeStore } from '../../domain/repositories/EmailThemeStore';

/** Persiste el tema visual de correo elegido por el profesional. */
export class ChooseEmailTheme {
  public constructor(private readonly store: EmailThemeStore) {}

  public async choose(theme: string): Promise<void> {
    if (!isEmailThemeId(theme)) throw new InvalidEmailThemeError(theme);
    await this.store.save(theme);
  }
}
