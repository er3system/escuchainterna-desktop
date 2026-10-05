import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { PwaRegister } from '@/components/PwaRegister';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
import { AppearanceProvider } from '@/components/appearance/AppearanceProvider';
import { appearanceBootstrap, parseAppearance } from '@/components/appearance/appearancePreferences';
import './globals.css';

// Tipografía de marca (Reverberación): display con carácter para titulares + Inter
// para cuerpo. Self-hosted por next/font (0 layout-shift), expuestas como variables.
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'EscuchaInterna',
  description:
    'Plataforma de gestión de consulta para psicólogos: agenda, pacientes, expedientes, diagnóstico CIE-11, pagos y biblioteca.',
  applicationName: 'EscuchaInterna',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EscuchaInterna',
  },
};

export const viewport: Viewport = {
  themeColor: '#16181d',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Preferencias validadas desde cookies. El bootstrap resuelve el modo automático
  // en <html> antes de pintar y el proveedor sigue los cambios de Windows.
  const jar = await cookies();
  const appearance = parseAppearance(jar.get('ei-theme')?.value, jar.get('ei-palette')?.value, jar.get('ei-motion')?.value);
  return (
    <html lang="es" suppressHydrationWarning className={`${display.variable} ${sans.variable}${appearance.mode === 'dark' ? ' dark' : ''}`} data-palette={appearance.palette} data-motion={appearance.motion}>
      <head><script dangerouslySetInnerHTML={{ __html: appearanceBootstrap(appearance) }} /></head>
      <body className="antialiased">
        <AppearanceProvider initial={appearance}>{children}</AppearanceProvider>
        {isDesktopEdition() ? null : <PwaRegister />}
      </body>
    </html>
  );
}
