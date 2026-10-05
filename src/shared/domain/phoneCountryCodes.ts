/**
 * Indicativos telefónicos (módulo puro: importable desde client components).
 * Hispanoamérica + España + países frecuentes de contacto.
 * Colombia va primero (v3 §8 Colombia-first): es el default visual del
 * PhoneInput cuando el dialCode recibido no coincide con ningún país.
 */

export interface PhoneCountry {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴' },
  { iso: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽' },
  { iso: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷' },
  { iso: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸' },
  { iso: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱' },
  { iso: 'PE', name: 'Perú', dialCode: '+51', flag: '🇵🇪' },
  { iso: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪' },
  { iso: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨' },
  { iso: 'GT', name: 'Guatemala', dialCode: '+502', flag: '🇬🇹' },
  { iso: 'CU', name: 'Cuba', dialCode: '+53', flag: '🇨🇺' },
  { iso: 'BO', name: 'Bolivia', dialCode: '+591', flag: '🇧🇴' },
  { iso: 'DO', name: 'República Dominicana', dialCode: '+1809', flag: '🇩🇴' },
  { iso: 'HN', name: 'Honduras', dialCode: '+504', flag: '🇭🇳' },
  { iso: 'PY', name: 'Paraguay', dialCode: '+595', flag: '🇵🇾' },
  { iso: 'SV', name: 'El Salvador', dialCode: '+503', flag: '🇸🇻' },
  { iso: 'NI', name: 'Nicaragua', dialCode: '+505', flag: '🇳🇮' },
  { iso: 'CR', name: 'Costa Rica', dialCode: '+506', flag: '🇨🇷' },
  { iso: 'PA', name: 'Panamá', dialCode: '+507', flag: '🇵🇦' },
  { iso: 'UY', name: 'Uruguay', dialCode: '+598', flag: '🇺🇾' },
  { iso: 'PR', name: 'Puerto Rico', dialCode: '+1787', flag: '🇵🇷' },
  { iso: 'GQ', name: 'Guinea Ecuatorial', dialCode: '+240', flag: '🇬🇶' },
  { iso: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸' },
  { iso: 'CA', name: 'Canadá', dialCode: '+1', flag: '🇨🇦' },
  { iso: 'BR', name: 'Brasil', dialCode: '+55', flag: '🇧🇷' },
  { iso: 'GB', name: 'Reino Unido', dialCode: '+44', flag: '🇬🇧' },
  { iso: 'DE', name: 'Alemania', dialCode: '+49', flag: '🇩🇪' },
  { iso: 'FR', name: 'Francia', dialCode: '+33', flag: '🇫🇷' },
  { iso: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹' },
  { iso: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹' },
];

export function findPhoneCountry(dialCode: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((country) => country.dialCode === dialCode);
}
