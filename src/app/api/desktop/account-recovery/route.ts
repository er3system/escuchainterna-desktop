import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { consumeDesktopRecoveryProof } from '@/shared/infrastructure/auth/desktopAccountRecovery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Exclusivo del proceso nativo: la recuperación pública por correo conserva sus reglas. */
export async function POST(request: Request): Promise<Response> {
  const noStore = { 'Cache-Control': 'no-store' };
  if (request.headers.get('origin') || Number(request.headers.get('content-length') ?? 0) > 2048) return new Response(null, { status: 403, headers: noStore });
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) return new Response(null, { status: 403, headers: noStore });
    body = JSON.parse(text);
  } catch { return new Response(null, { status: 400, headers: noStore }); }
  if (!body || typeof body !== 'object' || !('email' in body) || typeof body.email !== 'string' || body.email.length > 254
    || !consumeDesktopRecoveryProof(request.headers.get('x-desktop-recovery'), body.email, request.headers.get('host'))) return new Response(null, { status: 403, headers: noStore });
  const { resetUrl } = await createIdentityUseCases().requestDesktopPasswordReset.request(body.email, process.env.APP_URL!);
  return Response.json({ resetUrl }, { status: resetUrl ? 200 : 404, headers: noStore });
}
