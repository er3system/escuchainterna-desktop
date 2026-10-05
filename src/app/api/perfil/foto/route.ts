import path from 'node:path';
import { SqlitePractitionerProfileRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePractitionerProfileRepository';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';
import { getFileStorage } from '@/shared/infrastructure/files/getFileStorage';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET() {
  const context = await getActiveAppSessionContext();
  if (!context) return new Response('No autorizado', { status: 401 });
  const userId = context.userId;
  const profile = await new SqlitePractitionerProfileRepository().findByUserId(userId);
  if (!profile?.photoPath) return new Response('Sin foto de perfil', { status: 404 });

  const file = await getFileStorage().read(profile.photoPath);
  if (!file) return new Response('Sin foto de perfil', { status: 404 });

  const extension = path.extname(profile.photoPath).toLowerCase();
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': MIME_BY_EXTENSION[extension] ?? 'application/octet-stream',
      'Cache-Control': 'private, no-cache',
    },
  });
}
