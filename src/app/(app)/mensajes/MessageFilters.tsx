'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

const TIPOS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todo' },
  { value: 'automaticos', label: 'Automáticos' },
  { value: 'campanas', label: 'Campañas' },
];

export function MessageFilters({
  current,
}: {
  current: { canal: string; tipo: string; q: string };
}) {
  const router = useRouter();

  const navigate = (next: Partial<{ canal: string; tipo: string; q: string }>) => {
    const merged = { ...current, ...next };
    const params = new URLSearchParams();
    if (merged.canal) params.set('canal', merged.canal);
    if (merged.tipo) params.set('tipo', merged.tipo);
    if (merged.q) params.set('q', merged.q);
    const qs = params.toString();
    router.push(qs ? `/mensajes?${qs}` : '/mensajes');
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {/* Tipo: la categorización principal (Todo / Automáticos / Campañas). */}
      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {TIPOS.map((tipo, index) => (
          <button
            key={tipo.value || 'todo'}
            type="button"
            onClick={() => navigate({ tipo: tipo.value })}
            className={`px-3.5 py-2 text-sm font-medium transition-colors ${index > 0 ? 'border-l border-line' : ''} ${
              current.tipo === tipo.value ? 'bg-primary-light text-primary' : 'bg-surface text-ink-soft hover:text-ink'
            }`}
          >
            {tipo.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem('q') as HTMLInputElement;
          navigate({ q: input.value });
        }}
        className="relative"
      >
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
        <input
          key={current.q}
          type="search"
          name="q"
          defaultValue={current.q}
          aria-label="Buscar por destinatario"
          placeholder="Buscar por destinatario"
          className="w-64 rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary"
        />
      </form>

      <select
        value={current.canal}
        onChange={(event) => navigate({ canal: event.target.value })}
        aria-label="Filtrar por canal"
        className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
      >
        <option value="">Todos los canales</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="correo">Correo</option>
      </select>

      {current.canal || current.tipo || current.q ? (
        <button
          type="button"
          onClick={() => navigate({ canal: '', tipo: '', q: '' })}
          className="text-sm font-medium text-primary dark:text-accent-2 hover:underline"
        >
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}
