// Renderizador de markdown LIGERO → HTML para los exportables clínicos (encabezados,
// listas, negritas, citas y párrafos). Módulo PURO (sin Node): lo comparten el PDF
// (Playwright) y la vista previa en pantalla, para que el psicólogo NUNCA vea el código
// markdown crudo (#, **, -). Escapa el HTML del contenido del usuario: la salida solo
// contiene nuestras etiquetas, así que es segura para dangerouslySetInnerHTML.

export function escapeClinicalHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Negritas **texto** dentro de una línea YA escapada. */
function inlineMarkdown(escaped: string): string {
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Markdown ligero → HTML (h1-h3, listas, negritas, citas, párrafos). Escapa HTML. */
export function renderClinicalMarkdownToHtml(markdown: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = (): void => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const raw of (markdown ?? '').split('\n')) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      closeList();
      out.push(`<h3>${inlineMarkdown(escapeClinicalHtml(line.slice(4)))}</h3>`);
    } else if (/^## /.test(line)) {
      closeList();
      out.push(`<h2>${inlineMarkdown(escapeClinicalHtml(line.slice(3)))}</h2>`);
    } else if (/^# /.test(line)) {
      closeList();
      out.push(`<h1>${inlineMarkdown(escapeClinicalHtml(line.slice(2)))}</h1>`);
    } else if (/^> /.test(line)) {
      closeList();
      out.push(`<blockquote>${inlineMarkdown(escapeClinicalHtml(line.slice(2)))}</blockquote>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(escapeClinicalHtml(line.slice(2)))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inlineMarkdown(escapeClinicalHtml(line))}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}
