'use client';

import { useTilt } from './useTilt';

/**
 * Envoltorio que reacciona al cursor: inclinación 3D (.tilt) y, opcionalmente, un
 * foco que sigue al ratón (.spotlight). Pasa las clases de superficie por className.
 */
export function TiltCard({
  children,
  className = '',
  max = 6,
  spotlight = true,
}: {
  children: React.ReactNode;
  className?: string;
  max?: number;
  spotlight?: boolean;
}) {
  const tilt = useTilt(max);
  return (
    <div
      ref={tilt.ref}
      onMouseMove={tilt.onMouseMove}
      onMouseLeave={tilt.onMouseLeave}
      className={`tilt ${spotlight ? 'spotlight' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
