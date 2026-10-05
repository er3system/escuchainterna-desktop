import { RegisterCard } from './RegisterCard';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export const metadata = { title: 'Crear cuenta · EscuchaInterna' };

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  // Programa de referidos (v3 §11): /registro?ref=CODIGO viaja oculto en el
  // formulario; un código inválido jamás bloquea el registro.
  const { ref } = await searchParams;
  const referralCode = (ref ?? '').trim().toUpperCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <RegisterCard referralCode={isDesktopEdition() ? '' : referralCode} desktopEdition={isDesktopEdition()} />
    </div>
  );
}
