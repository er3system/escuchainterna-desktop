function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineMarkdown(escaped: string): string {
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/** Markdown ligero → HTML (encabezados, listas, negritas, párrafos). Escapa HTML. */
function renderMarkdown(markdown: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = (): void => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };
  for (const raw of markdown.split('\n')) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      closeList();
      out.push(`<h3>${inlineMarkdown(escapeHtml(line.slice(4)))}</h3>`);
    } else if (/^## /.test(line)) {
      closeList();
      out.push(`<h2>${inlineMarkdown(escapeHtml(line.slice(3)))}</h2>`);
    } else if (/^# /.test(line)) {
      closeList();
      out.push(`<h1>${inlineMarkdown(escapeHtml(line.slice(2)))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(escapeHtml(line.slice(2)))}</li>`);
    } else if (line.trim() === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inlineMarkdown(escapeHtml(line))}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

/**
 * HTML imprimible del portafolio pseudonimizado para Playwright (§3.4). Documento
 * autónomo. PURO y testable. No contiene datos identificatorios (el markdown ya viene
 * anonimizado).
 */
export function renderPortfolioPdfHtml(markdown: string): string {
  const body = renderMarkdown(markdown);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.55; }
  .content h1 { font-size: 19px; margin: 0 0 10px; }
  .content h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
  .content h3 { font-size: 12.5px; margin: 12px 0 4px; }
  .content p { margin: 5px 0; }
  .content ul { margin: 5px 0; padding-left: 20px; }
  .content li { margin: 2px 0; }
  .banner { background: #f1f5fb; border: 1px solid #d6e0ee; border-radius: 6px; padding: 8px 12px; font-size: 10.5px; color: #555; margin-bottom: 12px; }
</style>
</head>
<body>
  <div class="banner">Documento pseudonimizado · sin nombres, documento ni contenido clínico en texto libre.</div>
  <div class="content">${body}</div>
</body>
</html>`;
}
