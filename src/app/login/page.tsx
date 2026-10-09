import { LoginCard } from './LoginCard';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { readRememberedAccount } from '@/shared/infrastructure/auth/rememberedAccount';

export const metadata = { title: 'Iniciar sesión · EscuchaInterna' };

export default async function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <LoginCard desktopEdition={isDesktopEdition()} rememberedEmail={await readRememberedAccount()} />
    </div>
  );
}
