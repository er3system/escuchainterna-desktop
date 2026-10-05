export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 88 88" width={size} height={size} aria-hidden="true">
      <g fill="none" stroke="var(--color-accent)" strokeLinecap="round">
        <path className="echo-arc" style={{ ['--echo-base' as string]: '1' }} d="M44 14 a30 30 0 0 1 0 60" strokeWidth="7" />
        <path className="echo-arc" style={{ ['--echo-base' as string]: '0.75' }} d="M38 24 a20 20 0 0 1 0 40" strokeWidth="6" opacity="0.75" />
        <path className="echo-arc" style={{ ['--echo-base' as string]: '0.5' }} d="M32 34 a10 10 0 0 1 0 20" strokeWidth="5" opacity="0.5" />
      </g>
      <circle cx="22" cy="44" r="7" fill="var(--color-accent)" />
    </svg>
  );
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`logo-echo inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-display text-xl font-bold tracking-tight text-ink">
        escuchainterna<span className="text-accent">.</span>
      </span>
    </span>
  );
}
