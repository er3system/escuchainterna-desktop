'use client';

import { useRouter, usePathname } from 'next/navigation';
import { DoorOpen } from 'lucide-react';

interface ConsultorioOption {
  id: string;
  name: string;
}

/**
 * Filtro por consultorio de la vista institucional (consultorios §3, F4-bis): el maestro
 * (que ve TODOS los consultorios) puede acotar la lista a uno. Navega por searchParams
 * para que el filtrado lo haga el servidor (listInstitutionalPatients).
 */
export function ConsultorioFilter({
  consultorios,
  current,
}: {
  consultorios: ConsultorioOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <label className="flex items-center gap-2 text-xs text-ink-soft">
      <DoorOpen size={14} className="text-ink-soft" />
      Consultorio:
      <select
        value={current}
        onChange={(event) => {
          const value = event.target.value;
          router.push(value ? `${pathname}?consultorio=${encodeURIComponent(value)}` : pathname);
        }}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary"
      >
        <option value="">Todos los consultorios</option>
        {consultorios.map((consultorio) => (
          <option key={consultorio.id} value={consultorio.id}>
            {consultorio.name}
          </option>
        ))}
      </select>
    </label>
  );
}
