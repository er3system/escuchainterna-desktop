export interface ReferralActivationNotice {
  referrerUserId: string;
  /** Nombre (o correo) del colega referido que activó su suscripción. */
  referredDisplayName: string;
  /** Descuento acumulado del referente tras esta activación. */
  discountPercent: number;
}

/**
 * Puerto de aviso al referente cuando su referido activa la suscripción
 * (v3 §11). El adaptador local escribe una notificación in-app (campana).
 */
export interface ReferralActivationNotifier {
  notifyReferralActivated(notice: ReferralActivationNotice): Promise<void>;
}
