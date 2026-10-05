/**
 * Componentes de presentación compartidos por los documentos legales.
 * Server components puros (sin estado ni dependencias de Node).
 */

export function LegalHeader({
  title,
  subtitle,
  updatedAt,
}: {
  title: string;
  subtitle: string;
  updatedAt: string;
}) {
  return (
    <header className="mb-12 border-b border-line pb-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 text-base text-ink-soft">{subtitle}</p>
      <p className="mt-4 text-sm font-medium text-primary dark:text-accent-2">Última actualización: {updatedAt}</p>
    </header>
  );
}

export function LegalSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-xl font-bold text-ink">
        {number}. {title}
      </h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function LegalP({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.95rem] leading-relaxed text-ink-soft">{children}</p>;
}

export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-6">
      {items.map((item, index) => (
        <li key={index} className="text-[0.95rem] leading-relaxed text-ink-soft">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function LegalStrong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function LegalNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-primary/30 bg-primary-light/50 px-5 py-4 text-sm leading-relaxed text-ink dark:border-accent-2/20 dark:bg-primary/10">
      {children}
    </div>
  );
}
