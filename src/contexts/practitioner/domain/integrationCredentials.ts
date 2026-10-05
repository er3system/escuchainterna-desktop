/** Valor opaco que indica al cliente que una credencial ya existe sin revelarla. */
export const REDACTED_INTEGRATION_SECRET = '••••••••';

const INTEGRATION_SECRET_KEYS = new Set(['secret_key', 'access_token', 'refresh_token', 'code_verifier', 'client_secret', 'api_key']);

/** Campos cuyo valor nunca debe serializarse en HTML, RSC ni props de cliente. */
export function isIntegrationSecretKey(key: string): boolean {
  return INTEGRATION_SECRET_KEYS.has(key);
}

/** Proyección segura para presentación: conserva solo la presencia del secreto. */
export function redactIntegrationSecrets(
  config: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      isIntegrationSecretKey(key) && value !== '' ? REDACTED_INTEGRATION_SECRET : value,
    ]),
  );
}
