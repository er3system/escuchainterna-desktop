import { PasswordResetToken } from '../PasswordResetToken';

export interface PasswordResetTokenRepository {
  save(token: PasswordResetToken): Promise<void>;
  findByToken(token: string): Promise<PasswordResetToken | null>;
}
