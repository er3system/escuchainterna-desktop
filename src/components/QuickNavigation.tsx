'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Search, X } from 'lucide-react';

export interface NavigationDestination { href: string; label: string; group: string }
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function QuickNavigation({ destinations }: { destinations: NavigationDestination[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const pathname = usePathname();
  const matches = destinations.filter(item => normalize(`${item.label} ${item.group}`).includes(normalize(query.trim())));

  function show(): void {
    if (dialog.current?.open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    dialog.current?.showModal();
    input.current?.focus();
  }
  function close(): void { dialog.current?.close(); }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); show(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => { dialog.current?.close(); }, [pathname]);

  return <>
    <button type="button" onClick={show} className="ei-quick-navigation flex w-full items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2.5 text-xs text-ink-soft">
      <Search size={15} aria-hidden="true" /><span>Ir a una sección</span><kbd className="ml-auto rounded border border-line px-1 text-[10px]">Ctrl K</kbd>
    </button>
    <dialog ref={dialog} aria-labelledby="navigation-title" className="ei-navigation-dialog m-auto w-[min(560px,calc(100%-32px))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-xl" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }} onClose={() => returnFocus.current?.focus()} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 id="navigation-title" className="font-display font-bold">Ir a una sección</h2><button type="button" aria-label="Cerrar buscador de secciones" onClick={close} className="rounded-lg p-1.5 text-ink-soft"><X size={18} /></button></div>
      <div className="relative m-4"><Search className="absolute left-3 top-3 text-ink-soft" size={18} aria-hidden="true" /><input ref={input} type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Buscar sección" placeholder="Agenda, pacientes, biblioteca, sincronización…" className="w-full rounded-xl border border-line bg-bg py-2.5 pl-10 pr-3 text-sm" /></div>
      <nav aria-label="Resultados de navegación" className="max-h-[55vh] overflow-y-auto px-4 pb-4">
        {matches.length ? matches.map(item => <Link key={item.href} href={item.href} onClick={close} className="ei-option flex items-center gap-3 rounded-xl px-3 py-3 text-sm"><span className="flex-1 font-medium">{item.label}<span className="mt-0.5 block text-xs font-normal text-ink-soft">{item.group}</span></span><ArrowUpRight size={16} className="text-accent-strong" /></Link>) : <p role="status" className="px-3 py-5 text-sm text-ink-soft">No hay secciones con ese nombre. Prueba otro término.</p>}
      </nav>
      <p className="border-t border-line px-5 py-3 text-xs text-ink-soft">Tab para recorrer · Enter para abrir · Esc para cerrar</p>
    </dialog>
  </>;
}
