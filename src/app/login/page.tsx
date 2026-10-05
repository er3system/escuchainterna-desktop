import { LoginCard } from './LoginCard';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export const metadata = { title: 'Iniciar sesión · EscuchaInterna' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <LoginCard desktopEdition={isDesktopEdition()} />
    </div>
  );
}
