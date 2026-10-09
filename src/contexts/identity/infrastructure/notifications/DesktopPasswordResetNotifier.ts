import type { PasswordResetNotification, PasswordResetNotifier } from '../../domain/PasswordResetNotifier';

/** El proceso nativo abre el resultado en la misma PC; no se envía ni registra un correo. */
export class DesktopPasswordResetNotifier implements PasswordResetNotifier {
  public async sendResetLink(_notification: PasswordResetNotification): Promise<void> {
    return;
  }
}
