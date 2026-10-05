import { EmailVerificationToken } from '../EmailVerificationToken';

export interface EmailVerificationTokenRepository {
  save(token: EmailVerificationToken): Promise<void>;
  findByToken(token: string): Promise<EmailVerificationToken | null>;
}
