/** Activación de un referido: quién refirió y cómo mostrar al referido. */
export interface ReferralActivation {
  referralId: string;
  referrerUserId: string;
  /** Nombre (o correo) del referido, para el aviso al referente. */
  referredDisplayName: string;
}

/**
 * Programa de referidos (v3 §11): códigos por usuario (lazy) y registro/
 * activación de referidos. `referrals.referred_user_id` es UNIQUE: cada
 * cuenta solo puede ser referida una vez.
 */
export interface ReferralRepository {
  /** Devuelve el código del usuario, creándolo si aún no existe (8 chars legibles). */
  getOrCreateCode(userId: string): Promise<string>;
  /** userId del dueño del código (case-insensitive), o null si no existe. */
  findReferrerByCode(code: string): Promise<string | null>;
  /** Registra el referido con status 'registrado'. Ignora auto-referidos y duplicados. */
  registerReferral(referrerUserId: string, referredUserId: string): Promise<void>;
  /**
   * Marca 'activo' el referral donde este usuario es el referido (primer pago).
   * Devuelve los datos de la activación solo si el estado cambió (idempotente).
   */
  activateForReferredUser(referredUserId: string): Promise<ReferralActivation | null>;
  countActiveFor(referrerUserId: string): Promise<number>;
  countRegisteredFor(referrerUserId: string): Promise<number>;
}
