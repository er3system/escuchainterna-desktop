import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // El instalador incluye su servidor y dependencias, sin necesitar Node instalado.
  output: process.env.ESCUCHAINTERNA_DESKTOP_BUILD === '1' ? 'standalone' : undefined,
  // Paquetes que corren en runtime Node SIN empaquetar: node:sqlite (nativo) y
  // playwright (chromium, para generar el PDF de los reportes en el servidor).
  serverExternalPackages: ['playwright'],
  // El build de verificación usa SU PROPIA carpeta (.next-build) para no
  // pisar los chunks del dev server corriendo en .next — causa raíz de los
  // "Cannot find module './NNNN.js'" / ChunkLoadError recurrentes.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Evita que Next confunda el package-lock.json suelto de C:\Users\thinv.
  outputFileTracingRoot: path.join(__dirname),
  // SOLO DEV: permite que las server actions funcionen cuando se accede al dev
  // server por un túnel (compartir un demo). No tiene efecto en producción.
  allowedDevOrigins: ['*.trycloudflare.com'],
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
