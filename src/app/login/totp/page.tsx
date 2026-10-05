import { redirect } from 'next/navigation';
import { readTotpChallenge } from '@/shared/infrastructure/auth/session';
import { TotpCard } from './TotpCard';

export const metadata = { title: 'Verificación en dos pasos · EscuchaInterna' };

/**
 * Paso intermedio del login (v3 §1.3): solo accesible con un reto TOTP
 * vigente (cookie temporal firmada de 5 minutos).
 */
export default async function LoginTotpPage() {
  const userId = await readTotpChallenge();
  if (!userId) redirect('/login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <TotpCard />
    </div>
  );
}
