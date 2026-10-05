import Link from 'next/link';
import { HardDrive } from 'lucide-react';

export function DesktopStatusBanner() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-soft">
      <HardDrive size={14} aria-hidden="true" />
      <span>Tu consulta local · Los cambios se guardan en esta PC</span>
      <Link href="/configuracion/sincronizacion" className="ml-auto font-medium text-accent-strong hover:underline">
        Sincronización y continuidad
      </Link>
    </div>
  );
}
