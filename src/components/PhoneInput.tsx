'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { PHONE_COUNTRIES } from '@/shared/domain/phoneCountryCodes';

/**
 * Input de teléfono con selector buscable de indicativo de país.
 * Controlado: el padre maneja dialCode y number por separado.
 * En formularios no controlados usa los hiddenName* para enviar ambos valores.
 */
export function PhoneInput({
  dialCode,
  number,
  onChange,
  hiddenNameDialCode,
  hiddenNameNumber,
  placeholder = 'Número de teléfono',
  required = false,
}: {
  dialCode: string;
  number: string;
  onChange: (next: { dialCode: string; number: string }) => void;
  hiddenNameDialCode?: string;
  hiddenNameNumber?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = PHONE_COUNTRIES.find((country) => country.dialCode === dialCode) ?? PHONE_COUNTRIES[0];

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(text) ||
        country.dialCode.includes(text.replace(/^\+?/, '+')) ||
        country.dialCode.replace('+', '').startsWith(text.replace('+', '')),
    );
  }, [query]);

  return (
    <div ref={containerRef} className="relative flex">
      {hiddenNameDialCode ? <input type="hidden" name={hiddenNameDialCode} value={selected.dialCode} /> : null}
      {hiddenNameNumber ? <input type="hidden" name={hiddenNameNumber} value={number} /> : null}
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex shrink-0 items-center gap-1 rounded-l-lg border border-r-0 border-line bg-bg px-2.5 py-2 text-sm text-ink hover:bg-primary-light"
        aria-label="Indicativo del país"
      >
        <span>{selected.flag}</span>
        <span className="font-mono text-xs">{selected.dialCode}</span>
        <ChevronDown size={13} className="text-ink-soft" />
      </button>
      <input
        type="tel"
        value={number}
        required={required}
        onChange={(event) => onChange({ dialCode: selected.dialCode, number: event.target.value })}
        placeholder={placeholder}
        className="w-full rounded-r-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light"
      />
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-card border border-line bg-surface shadow-card">
          <div className="relative border-b border-line p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar país o indicativo…"
              className="w-full rounded-lg border border-line bg-bg py-1.5 pl-7 pr-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.map((country) => (
              <li key={country.iso}>
                <button
                  type="button"
                  onClick={() => {
                    onChange({ dialCode: country.dialCode, number });
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-primary-light ${
                    country.dialCode === selected.dialCode && country.iso === selected.iso ? 'bg-bg font-medium' : ''
                  }`}
                >
                  <span>{country.flag}</span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="font-mono text-xs text-ink-soft">{country.dialCode}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-ink-soft">Sin resultados</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
