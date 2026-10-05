import path from 'node:path';

/** La edición se decide en el servidor; nunca se acepta desde el navegador. */
export function isDesktopEdition(): boolean {
  return process.env.ESCUCHAINTERNA_DESKTOP === '1';
}

/** Canales que solo dejan un registro en esta edición, sin servicio de entrega. */
export function locallyRecordedMessageChannels(): Array<'whatsapp' | 'email'> {
  if (!isDesktopEdition()) return [];
  return process.env.RESEND_API_KEY?.trim() ? ['whatsapp'] : ['whatsapp', 'email'];
}

/** Rutas de datos locales para la pantalla de configuración, sin credenciales. */
export function desktopDataLocations(): { databaseDirectory: string; uploadsDirectory: string } {
  const databasePath = path.resolve(process.cwd(), process.env.DATABASE_PATH ?? './data/escuchainterna.db');
  return {
    databaseDirectory: path.dirname(databasePath),
    uploadsDirectory: path.resolve(process.cwd(), process.env.UPLOADS_PATH ?? './data/uploads'),
  };
}
