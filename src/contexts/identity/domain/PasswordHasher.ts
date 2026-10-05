export interface PasswordHasher {
  hash(plain: string): string;
  verify(plain: string, storedHash: string): boolean;
}
