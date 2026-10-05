import { UserAccount } from '../UserAccount';

export interface UserAccountRepository {
  save(account: UserAccount): Promise<void>;
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
  /** Marca el correo de la cuenta como verificado (doble opt-in). Idempotente. */
  markEmailVerified(userId: string): Promise<void>;
  /**
   * Sella la aceptación de los T&C + aviso de privacidad (qué versión y cuándo) al
   * registrarse — prueba de autorización informada (Ley 1581). La fecha la pone el repo.
   */
  recordTermsAcceptance(userId: string, termsVersion: string, privacyVersion: string): Promise<void>;
}
