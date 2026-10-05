/** Puerto de notificación del enlace de recuperación (en local: outbox). */
export interface PasswordResetNotification {
  userId: string;
  email: string;
  fullName: string;
  resetUrl: string;
}

export interface PasswordResetNotifier {
  sendResetLink(notification: PasswordResetNotification): Promise<void>;
}
