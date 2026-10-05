'use client';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function WorkspaceTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="ei-route-enter" key={pathname}>{children}</div>;
}
