import fs from 'node:fs';
import { PublicationContent, PublicationHeading } from '../../domain/PublicationContent';
import { PublicationContentReader } from '../../domain/repositories/PublicationContentReader';
import { resolvePublicationAssetPath } from './PublicationManifestReader';

const MAIN_OPEN = '<main class="content">';
const MAIN_CLOSE = '</main>';
const DOC_FOOTER_OPEN = '<div class="doc-footer">';

/**
 * Lee el HTML de imprenta de una publicación (data/publicaciones-src/html) y
 * extrae SOLO el cuerpo legible para el lector web: lo que hay dentro de
 * <main class="content">, sin la portada (.cover, que queda fuera de <main>),
 * sin el pie del PDF (.doc-footer) y sin <script> (defensa en profundidad:
 * los fuentes son nuestros y no llevan scripts, pero se eliminan igualmente).
 */
export class HtmlPublicationContentReader implements PublicationContentReader {
  // eslint-disable-next-line @typescript-eslint/require-await -- contrato async del puerto; el fs es síncrono.
  public async read(htmlPath: string): Promise<PublicationContent | null> {
    const absolutePath = resolvePublicationAssetPath(htmlPath);
    if (!absolutePath || !fs.existsSync(absolutePath)) return null;
    return extractPublicationContent(fs.readFileSync(absolutePath, 'utf-8'));
  }
}

/**
 * Extracción pura (testeable): recorta el <main>, quita el pie del PDF,
 * elimina scripts, inyecta anclas en h1/h2 (devolviendo el índice) y envuelve
 * las tablas para permitir scroll horizontal en pantallas estrechas.
 */
export function extractPublicationContent(rawHtml: string): PublicationContent | null {
  const start = rawHtml.indexOf(MAIN_OPEN);
  if (start === -1) return null;
  const end = rawHtml.indexOf(MAIN_CLOSE, start);
  if (end === -1) return null;

  let html = rawHtml.slice(start + MAIN_OPEN.length, end);
  html = removeBalancedDiv(html, DOC_FOOTER_OPEN);
  html = stripScripts(html);
  const { html: anchored, headings } = injectHeadingAnchors(html);
  return { html: wrapTables(anchored).trim(), headings };
}

/** Elimina cada bloque <div class="...">…</div> balanceando divs anidados. */
function removeBalancedDiv(html: string, openTag: string): string {
  let result = html;
  let openIndex = result.indexOf(openTag);
  while (openIndex !== -1) {
    let depth = 1;
    let cursor = openIndex + openTag.length;
    while (depth > 0) {
      const nextOpen = result.indexOf('<div', cursor);
      const nextClose = result.indexOf('</div>', cursor);
      if (nextClose === -1) return result; // HTML malformado: se deja tal cual.
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        cursor = nextOpen + 4;
      } else {
        depth -= 1;
        cursor = nextClose + '</div>'.length;
      }
    }
    result = result.slice(0, openIndex) + result.slice(cursor);
    openIndex = result.indexOf(openTag);
  }
  return result;
}

function stripScripts(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '');
}

/**
 * Inyecta id="…" en cada h1/h2 del contenido y devuelve el índice de
 * contenidos. Los encabezados de los fuentes son texto plano; aun así se
 * tolera marcado interno (se ignora al calcular el texto del índice).
 */
function injectHeadingAnchors(html: string): { html: string; headings: PublicationHeading[] } {
  const headings: PublicationHeading[] = [];
  const usedSlugs = new Map<string, number>();

  const result = html.replace(
    /<h([12])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (_match, levelRaw: string, _attrs: string | undefined, inner: string) => {
      const level: 1 | 2 = levelRaw === '1' ? 1 : 2;
      const text = decodeBasicEntities(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      const id = uniqueSlug(text, usedSlugs);
      headings.push({ id, text, level });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );

  return { html: result, headings };
}

function uniqueSlug(text: string, usedSlugs: Map<string, number>): string {
  const base =
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'seccion';
  const seen = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Envuelve cada tabla para que el lector pueda darle scroll horizontal en móvil. */
function wrapTables(html: string): string {
  return html
    .replace(/<table(\s[^>]*)?>/gi, '<div class="lector-tabla"><table$1>')
    .replace(/<\/table>/gi, '</table></div>');
}
