import Link from 'next/link';
import { BookOpen, FolderOpen } from 'lucide-react';

export function CollectionNavigation({ selected }: { selected: 'publicaciones' | 'libros' }) {
  return <nav aria-label="Catálogos de biblioteca" className="mb-5 flex flex-wrap gap-2">
    {([{ id: 'publicaciones', href: '/biblioteca', title: 'Colección EscuchaInterna', icon: BookOpen }, { id: 'libros', href: '/biblioteca/libros', title: 'Libros de esta PC', icon: FolderOpen }] as const).map(({ id, href, title, icon: Icon }) => <Link key={id} href={href} aria-current={selected === id ? 'page' : undefined} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${selected === id ? 'border-accent-strong bg-primary-light text-primary' : 'border-line bg-surface text-ink-soft hover:text-ink'}`}><Icon size={17} />{title}</Link>)}
  </nav>;
}
