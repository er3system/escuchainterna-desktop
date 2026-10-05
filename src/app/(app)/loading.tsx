/** Esqueleto de carga entre páginas de la app (evita la sensación de "congelado"). */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden="true">
      <div className="h-7 w-52 rounded-lg bg-line" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-line" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-card border border-line bg-surface" />
        ))}
      </div>
      <div className="mt-3 h-64 rounded-card border border-line bg-surface" />
    </div>
  );
}
