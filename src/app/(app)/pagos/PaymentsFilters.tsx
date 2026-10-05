'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';

export function PaymentsFilters({ knownTags }: { knownTags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onlyCompleted = searchParams.get('completadas') !== '0';
  const estado = searchParams.get('estado') ?? '';
  const desde = searchParams.get('desde') ?? '';
  const hasta = searchParams.get('hasta') ?? '';
  const activeTags = (searchParams.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const [text, setText] = useState(searchParams.get('q') ?? '');
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  const onTextChange = (value: string) => {
    setText(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q: value.trim() || null }), 350);
  };

  const toggleTag = (tag: string) => {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    apply({ tags: next.length > 0 ? next.join(',') : null });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={onlyCompleted}
          onChange={(event) => apply({ completadas: event.target.checked ? null : '0' })}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        Solo completadas
      </label>

      <select
        value={estado}
        onChange={(event) => apply({ estado: event.target.value || null })}
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink"
        aria-label="Estado de pago"
      >
        <option value="">Cualquier estado de pago</option>
        <option value="pendiente">Pendientes</option>
        <option value="pagada">Pagadas</option>
      </select>

      <div className="flex items-center gap-1 text-sm text-ink-soft">
        <input
          type="date"
          value={desde}
          onChange={(event) => apply({ desde: event.target.value || null })}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          aria-label="Desde"
        />
        <span>–</span>
        <input
          type="date"
          value={hasta}
          onChange={(event) => apply({ hasta: event.target.value || null })}
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          aria-label="Hasta"
        />
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          type="search"
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Buscar por paciente o correo"
          className="w-60 rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-ink-soft"
        />
      </div>

      {knownTags.length > 0 ? (
        <div className="flex w-full flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-ink-soft">Etiquetas:</span>
          {knownTags.map((tag) => {
            const active = activeTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-white'
                    : 'bg-primary-light text-primary hover:bg-primary hover:text-white'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
