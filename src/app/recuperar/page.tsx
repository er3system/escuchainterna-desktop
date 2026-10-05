import { emailChannel } from '@/shared/infrastructure/config/channels';
import { isProduction } from '@/shared/infrastructure/config/runtime';
import { RequestResetCard } from './RequestResetCard';

export const metadata = { title: 'Recuperar contraseña · EscuchaInterna' };

export default function RecuperarPage() {
  // En producción SIN proveedor de correo, el enlace de recuperación jamás
  // llegaría al usuario (moriría en la bandeja interna): en vez de prometer un
  // correo, la tarjeta ofrece la vía de soporte. En dev el flujo funciona con
  // el enlace inline de "modo local", así que no se gatea.
  const emailUnavailable = isProduction() && !emailChannel().configured;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <RequestResetCard emailUnavailable={emailUnavailable} />
    </div>
  );
}
