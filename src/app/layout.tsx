import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import { PwaRegister } from '@/components/PwaRegister';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';
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
  // Tema oscuro GLOBAL por cookie, leído en el servidor (sin parpadeo/FOUC). La clase .dark va en
  // <body> → cubre el sitio público (landing, auth, legal) además de la app. Los layouts internos
  // ((app)/organizacion/supervision) ya aplican su propio .dark; anidarlo es inocuo (re-fija tokens).
  const dark = (await cookies()).get('ei-theme')?.value === 'dark';
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body className={dark ? 'antialiased dark' : 'antialiased'}>
        {children}
        {isDesktopEdition() ? null : <PwaRegister />}
      </body>
    </html>
  );
}
