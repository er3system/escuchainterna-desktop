import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { SynchronizationPanel } from '@/components/desktop/SynchronizationPanel';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default async function SincronizacionInicialPage({ searchParams }: { searchParams: Promise<{ registro?: string }> }) {
  if (!isDesktopEdition()) notFound();
  const registering = (await searchParams).registro === '1';
  return <main className="mx-auto max-w-5xl px-6 py-10"><Link href={registering ? '/onboarding' : '/'} className="mb-6 inline-flex items-center gap-2 text-sm text-accent-strong"><ArrowLeft size={16} /> {registering ? 'Continuar con mi perfil · puedo configurar Drive después' : 'Volver a mi consulta'}</Link><PageHeader title={registering ? 'Tu cuenta está lista · prepara Drive' : 'Sincronización con Drive'} subtitle="Conecta esta instalación o continúa una consulta desde otra PC." /><SynchronizationPanel />{registering ? <Link href="/onboarding" className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white">Continuar con mi perfil</Link> : null}</main>;
}
