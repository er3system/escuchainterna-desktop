import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { SynchronizationPanel } from '@/components/desktop/SynchronizationPanel';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default function SincronizacionInicialPage() {
  if (!isDesktopEdition()) notFound();
  return <main className="mx-auto max-w-5xl px-6 py-10"><Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-accent-strong"><ArrowLeft size={16} /> Volver a mi consulta</Link><PageHeader title="Sincronización con Drive" subtitle="Conecta esta instalación o continúa una consulta desde otra PC." /><SynchronizationPanel /></main>;
}
