import Link from 'next/link';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { SqlitePersonalProviderRepository } from '@/contexts/practitioner/infrastructure/persistence/SqlitePersonalProviderRepository';
import { aiCloudEnabled } from '@/shared/infrastructure/ai-billing/aiCloudGate';
export async function OptionalServiceNotice({ ownerUserId, feature }: { ownerUserId: string; feature: 'chat' | 'email' | 'clinical' }) {
  if (!isDesktopEdition()) return null;
  const repository = new SqlitePersonalProviderRepository();
  const config = feature !== 'email' && !(await aiCloudEnabled()) ? null : feature === 'chat' ? await repository.activeAi(ownerUserId) : await repository.find(ownerUserId, feature === 'email' ? 'resend' : 'anthropic');
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-ink-soft">
    <p>{config ? `Usarás tu cuenta de ${config.provider === 'openai' ? 'OpenAI' : config.provider === 'resend' ? 'Resend' : 'Anthropic'} por internet. El proveedor cobra el uso a tu cuenta.` : feature === 'email' ? 'Solo registro local: los correos no se envían hasta conectar tu clave de Resend.' : 'Modo local sin conexión. Conecta tu propia clave para activar respuestas generadas por IA.'}{feature === 'email' ? ' Las automatizaciones se revisan al abrir Marketing; requieren el programa abierto.' : ''}</p>
    <Link href="/configuracion/integraciones" className="font-semibold text-accent-strong underline">{config ? 'Gestionar mi clave' : 'Insertar mi propia clave'}</Link>
  </div>;
}
