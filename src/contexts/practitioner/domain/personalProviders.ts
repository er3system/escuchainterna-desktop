/** Catálogo puro para la edición PC; únicamente adaptadores implementados. */
export const PERSONAL_PROVIDERS = ['resend', 'openai', 'anthropic'] as const;
export type PersonalProviderName = (typeof PERSONAL_PROVIDERS)[number];
export function isPersonalProvider(value: string): value is PersonalProviderName {
  return PERSONAL_PROVIDERS.some(provider => provider === value);
}
