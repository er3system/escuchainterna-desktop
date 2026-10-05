import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { SynchronizationPanel } from '@/components/desktop/SynchronizationPanel';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default function SincronizacionPage() {
  if (!isDesktopEdition()) notFound();
  return <div className="mx-auto max-w-5xl"><PageHeader title="Sincronización con Drive" subtitle="Continúa en otra PC conservando tu consulta local y tus versiones cifradas." /><SynchronizationPanel /></div>;
}
