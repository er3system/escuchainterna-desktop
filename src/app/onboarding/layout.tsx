import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex h-16 items-center justify-center border-b border-line bg-surface">
        <p className="text-xl font-bold tracking-tight text-ink">
          escucha<span className="text-primary dark:text-accent-2">interna</span>
        </p>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">{children}</main>
    </div>
  );
}
