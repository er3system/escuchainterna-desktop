import { PublicationContent } from '../PublicationContent';

/**
 * Puerto de lectura del contenido de una publicación de la colección.
 * Devuelve null si el archivo no existe, la ruta es insegura o el
 * documento no tiene cuerpo legible.
 */
export interface PublicationContentReader {
  read(htmlPath: string): Promise<PublicationContent | null>;
}
