'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker (/sw.js) al cargar la app.
 * Solo en producción: en `next dev` un SW con cache estático provoca
 * assets obsoletos y dificulta el desarrollo.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin SW la app sigue funcionando; solo se pierde la instalabilidad.
    });
  }, []);
  return null;
}
