import { X } from 'lucide-react';

/** Iniciales (1-2 letras) para el avatar de una persona. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Tarjeta-persona: avatar con iniciales + nombre + rol. Lenguaje visual común de
 * los casos relacionales (pareja y familia). Si recibe `onRemove`, muestra una
 * acción para quitar/cambiar a esa persona.
 */
export function PersonCard({
  name,
  role,
  onRemove,
  removeLabel = 'Quitar',
}: {
  name: string;
  role: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="relative flex h-full w-full flex-col items-center gap-2 rounded-card border border-primary/30 dark:border-accent-2/25 bg-primary-light/40 dark:bg-primary/15 p-4 text-center">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft shadow-card transition hover:text-primary dark:hover:text-accent-2"
        >
          <X size={11} /> {removeLabel}
        </button>
      ) : null}
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
        {initials(name)}
      </span>
      <span className="font-semibold leading-tight text-ink">{name}</span>
      <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-soft">{role}</span>
    </div>
  );
}
