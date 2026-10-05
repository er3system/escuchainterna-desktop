import { ResetPasswordCard } from './ResetPasswordCard';

export const metadata = { title: 'Nueva contraseña · EscuchaInterna' };

export default async function NuevaContrasenaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <ResetPasswordCard token={token} />
    </div>
  );
}
