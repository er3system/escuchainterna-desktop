import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { PageHeader } from '@/components/ui';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { SqliteBookRepository } from '@/contexts/library/infrastructure/persistence/SqliteBookRepository';
import { resolveBookFilePath } from '@/contexts/library/infrastructure/filesystem/BookFilePath';

export default async function LocalBookPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveAppSessionUserId();
  if (!isDesktopEdition()) redirect('/biblioteca');
  const book = await new SqliteBookRepository().findById((await params).id);
  if (!book) notFound();
  const data = book.toPrimitives();
  const available = Boolean(resolveBookFilePath(data.relativePath));
  const file = `/api/biblioteca/${data.id}/file`;
  return <div>
    <Link href="/biblioteca/libros" className="mb-5 inline-flex items-center gap-2 text-sm text-accent-strong"><ArrowLeft size={16} />Volver a tus libros</Link>
    <PageHeader title={data.title} subtitle={[data.author, data.category].filter(Boolean).join(' · ')} actions={available ? <a href={file} download className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 text-sm"><Download size={16} />Descargar archivo</a> : undefined} />
    {!available ? <p className="rounded-card border border-line bg-surface p-5 text-sm text-ink-soft">Este libro figura en el índice, pero su archivo aún no está instalado en esta PC. Instala aquí el catálogo correspondiente para poder abrirlo.</p> : book.isReadableInBrowser() ? <iframe title={`Leer ${data.title}`} src={file} className="h-[75vh] min-h-96 w-full rounded-card border border-line bg-surface" /> : <div className="rounded-card border border-line bg-surface p-6"><p className="mb-4 text-sm text-ink-soft">Este formato se abre con un lector compatible en tu PC.</p><a href={file} download className="inline-block rounded-xl bg-primary px-4 py-2 text-sm text-white">Descargar {data.extension.toUpperCase()}</a></div>}
  </div>;
}
