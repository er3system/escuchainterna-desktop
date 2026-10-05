import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BookOpen, FileText, RefreshCw, Search } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { SqliteBookRepository } from '@/contexts/library/infrastructure/persistence/SqliteBookRepository';
import { SearchBooks } from '@/contexts/library/application/search-books/SearchBooks';
import { SearchBooksQuery } from '@/contexts/library/application/search-books/SearchBooksQuery';
import { IndexLibrary } from '@/contexts/library/application/index-library/IndexLibrary';
import { CollectionNavigation } from '../CollectionNavigation';
import { indexLocalBooksAction } from './actions';

const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? '' : value ?? '';
export default async function LocalBooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveAppSessionUserId();
  if (!isDesktopEdition()) redirect('/biblioteca');
  const params = await searchParams;
  const repository = new SqliteBookRepository();
  if (await repository.totalBooks() === 0) await new IndexLibrary(repository).index();
  const q = first(params.q).trim(), category = first(params.categoria).trim();
  const requestedPage = Number(first(params.pagina));
  const page = Number.isSafeInteger(requestedPage) ? Math.min(100000, Math.max(1, requestedPage)) : 1;
  const pageSize = 36;
  const result = await new SearchBooks(repository).search(SearchBooksQuery.fromPrimitives({ text: q, category, page, pageSize }));
  const pages = Math.max(1, Math.ceil(result.total / pageSize));
  function url(destination: number): string { const query = new URLSearchParams({ pagina: String(destination) }); if (q) query.set('q', q); if (category) query.set('categoria', category); return `/biblioteca/libros?${query}`; }
  return <div>
    <CollectionNavigation selected="libros" />
    <PageHeader title="Libros de esta PC" subtitle="Tu biblioteca anterior, organizada por categorías y disponible sin conexión." actions={<form action={indexLocalBooksAction}><button type="submit" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm"><RefreshCw size={16} />Actualizar índice</button></form>} />
    <div className="mb-5 rounded-xl border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-ink-soft">Estos archivos pertenecen al catálogo local compartido de esta instalación. Los contenidos se instalan aparte en cada PC y no se incluyen en la sincronización clínica ni en el instalador público.</div>
    {first(params.indexados) ? <p role="status" className="mb-4 text-sm text-accent-strong">Índice actualizado: {first(params.indexados)} archivos añadidos.</p> : null}
    <form action="/biblioteca/libros" method="get" className="mb-5 flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4">
      <label className="min-w-48 flex-1 text-xs font-semibold">Título, autor o tema<span className="relative mt-2 block"><Search size={16} className="absolute left-3 top-3 text-ink-soft" aria-hidden="true" /><input name="q" type="search" defaultValue={q} placeholder="Buscar en tus libros…" className="w-full rounded-xl border border-line bg-bg py-2.5 pl-9 pr-3 text-sm font-normal" /></span></label>
      <label className="text-xs font-semibold">Categoría<select name="categoria" defaultValue={category} className="mt-2 block max-w-72 rounded-xl border border-line bg-bg px-3 py-2.5 text-sm font-normal"><option value="">Todas las categorías</option>{result.categories.map(item => <option key={item.category} value={item.category}>{item.category} · {item.total}</option>)}</select></label>
      <button type="submit" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-dark">Buscar libros</button>{q || category ? <Link href="/biblioteca/libros" className="px-3 py-2.5 text-sm text-accent-strong">Limpiar filtros</Link> : null}
    </form>
    <p className="mb-4 text-sm text-ink-soft">{result.total.toLocaleString('es')} {result.total === 1 ? 'archivo' : 'archivos'} · Página {page} de {pages}</p>
    {result.books.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{result.books.map(book => <Link key={book.id} href={`/biblioteca/libros/${book.id}`} className="ei-card ei-option flex gap-3 rounded-card border border-line bg-surface p-4"><span className="ei-icon-tile"><FileText size={19} /></span><span className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-accent-strong">{book.extension.slice(1)} · {(book.sizeBytes / 1048576).toFixed(1)} MB</span><span className="line-clamp-2 font-display text-sm font-semibold">{book.title}</span>{book.author ? <span className="mt-1 block text-xs text-ink-soft">{book.author}</span> : null}<span className="mt-2 block truncate text-xs text-ink-soft">{book.category}</span></span></Link>)}</div> : <EmptyState title={q || category ? 'Sin resultados' : 'No hay libros instalados'} description={q || category ? 'Cambia los términos o limpia los filtros para ver otros libros.' : 'Usa Archivo → Abrir carpeta de catálogos. Copia tus libros a su subcarpeta biblioteca, reinicia el programa y actualiza el índice.'} action={<Link href="/biblioteca/libros" className="text-accent-strong">Volver al catálogo</Link>} />}
    <nav aria-label="Páginas de libros" className="mt-6 flex justify-between gap-3">{page > 1 ? <Link href={url(page - 1)} className="rounded-xl border border-line bg-surface px-4 py-2 text-sm">Anterior</Link> : <span />}{page < pages ? <Link href={url(page + 1)} className="rounded-xl border border-line bg-surface px-4 py-2 text-sm">Siguiente</Link> : null}</nav>
    <p className="mt-5 flex items-center gap-2 text-xs text-ink-soft"><BookOpen size={14} />Abre un libro para leerlo o descargar su archivo original.</p>
  </div>;
}
