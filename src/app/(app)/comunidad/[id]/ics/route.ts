import { NextRequest } from 'next/server';
import { SqliteCommunityEventRepository } from '@/contexts/community/infrastructure/persistence/SqliteCommunityEventRepository';
import { CommunityEventIcsRenderer } from '@/contexts/community/infrastructure/calendar/CommunityEventIcsRenderer';
import { getActiveAppSessionContext } from '@/shared/infrastructure/auth/dataOwner';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getActiveAppSessionContext())) return new Response('No autorizado', { status: 401 });
  const { id } = await params;
  const event = await new SqliteCommunityEventRepository().findById(id);
  if (!event) return new Response('Evento no encontrado', { status: 404 });

  const primitives = event.toPrimitives();
  const ics = new CommunityEventIcsRenderer().render(primitives);
  const slug = primitives.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="evento-${slug || 'comunidad'}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
