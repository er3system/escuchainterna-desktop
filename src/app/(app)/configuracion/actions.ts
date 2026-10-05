'use server';

import { redirect } from 'next/navigation';
import { destroySession } from '@/shared/infrastructure/auth/session';

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/login');
}
