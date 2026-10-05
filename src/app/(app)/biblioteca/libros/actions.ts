'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { IndexLibrary } from '@/contexts/library/application/index-library/IndexLibrary';
import { SqliteBookRepository } from '@/contexts/library/infrastructure/persistence/SqliteBookRepository';

export async function indexLocalBooksAction(): Promise<void> {
  await requireActiveAppSessionUserId();
  if (!isDesktopEdition()) redirect('/biblioteca');
  const result = await new IndexLibrary(new SqliteBookRepository()).index();
  revalidatePath('/biblioteca/libros');
  redirect(`/biblioteca/libros?indexados=${result.indexed}`);
}
