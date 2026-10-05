import { redirect } from 'next/navigation';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { getSessionUserId } from '@/shared/infrastructure/auth/session';

export interface AdminSession {
  userId: string;
  email: string;
  fullName: string;
}

/**
 * Guard de TODO el hub /admin (páginas y server actions): exige sesión con rol
 * `admin`. Sin sesión → /login; con sesión de otro rol → /inicio.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const context = await createIdentityUseCases().getSessionContext.get(userId);
  if (!context || context.status === 'suspendido') redirect('/login');
  if (context.role !== 'admin') redirect('/inicio');

  return { userId: context.userId, email: context.email, fullName: context.fullName };
}
