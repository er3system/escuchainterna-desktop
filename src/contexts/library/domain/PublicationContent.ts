/** Encabezado extraído del contenido de una publicación (para el índice del lector). */
export interface PublicationHeading {
  /** Ancla única dentro del documento (slug del texto del encabezado). */
  id: string;
  /** Texto plano del encabezado, sin etiquetas ni entidades. */
  text: string;
  level: 1 | 2;
}

/**
 * Contenido legible de una publicación de la colección: solo el cuerpo del
 * documento (sin portada de imprenta ni pie de página del PDF), con anclas
 * inyectadas en los encabezados y el índice de contenidos ya calculado.
 */
export interface PublicationContent {
  html: string;
  headings: PublicationHeading[];
}
