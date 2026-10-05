'use client';

/**
 * Switch accesible y reutilizable: pista con colores claros de encendido y
 * apagado, knob blanco con sombra que se desliza y anillo de enfoque visible.
 * Usa `role="switch"` + `aria-checked` para lectores de pantalla.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Etiqueta accesible (aria-label); el texto visible va fuera del switch. */
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6.5 w-11.5 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? 'border-primary bg-primary'
          : 'border-line bg-ink-soft/25 hover:bg-ink-soft/35'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-0.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.35)] transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
