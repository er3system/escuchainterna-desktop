import Link from 'next/link';
import { HardDrive } from 'lucide-react';

export function DesktopStatusBanner() {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-4 py-2 text-xs text-ink-soft">
      <HardDrive size={14} aria-hidden="true" />
      <span>Guardado en esta PC · Sin sincronización automática</span>
      <Link href="/configuracion" className="ml-auto font-medium text-primary hover:underline">
        Datos y copias de seguridad
      </Link>
    </div>
  );
}
