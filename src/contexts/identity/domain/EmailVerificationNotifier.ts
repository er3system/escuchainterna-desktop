/** Puerto de notificación del enlace de verificación de correo (en local: outbox). */
export interface EmailVerificationNotification {
  userId: string;
  email: string;
  fullName: string;
  verifyUrl: string;
}

export interface EmailVerificationNotifier {
  sendVerificationLink(notification: EmailVerificationNotification): Promise<void>;
}
