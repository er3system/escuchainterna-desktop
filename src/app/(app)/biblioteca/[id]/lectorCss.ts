/**
 * Estilos del lector web de la Colección EscuchaInterna, con alcance limitado
 * al wrapper .lector. Re-estilizan para PANTALLA las clases del HTML de
 * imprenta (lead, callout, sources, tablas) sin tocar los archivos fuente,
 * que siguen siendo la base del PDF interno.
 */
export const lectorCss = `
  html:has(.lector) { scroll-behavior: smooth; }

  .lector {
    font-size: var(--lector-font-size, 17px);
    line-height: 1.75;
    color: var(--color-ink);
    overflow-wrap: break-word;
  }
  .lector > :first-child { margin-top: 0; }

  .lector p {
    margin: 0 0 1.1em;
    text-align: left;
  }

  .lector h1, .lector h2, .lector h3 {
    line-height: 1.3;
    color: var(--color-ink);
    scroll-margin-top: 4.5rem;
  }
  .lector h1 {
    font-size: 1.55em;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 2.4em 0 0.7em;
    padding-bottom: 0.35em;
    border-bottom: 2px solid var(--color-primary-light);
  }
  .lector h2 {
    font-size: 1.25em;
    font-weight: 600;
    color: var(--color-primary-dark);
    margin: 1.9em 0 0.55em;
  }
  .lector h3 {
    font-size: 1.06em;
    font-weight: 600;
    margin: 1.5em 0 0.45em;
  }

  .lector ul, .lector ol {
    margin: 0 0 1.2em;
    padding-left: 1.5em;
  }
  .lector li { margin-bottom: 0.45em; }
  .lector li::marker { color: var(--color-primary); }
  .lector strong { font-weight: 600; color: var(--color-ink); }
  .lector a {
    color: var(--color-primary-dark);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* Entradilla: destacada pero pensada para leerse, sin cursiva larga. */
  .lector .lead {
    font-size: 1.14em;
    line-height: 1.7;
    font-style: normal;
    color: var(--color-ink-soft);
    border-left: 3px solid var(--color-primary);
    padding: 0.2em 0 0.2em 1.1em;
    margin: 0 0 2em;
  }

  /* Callouts del documento como tarjetas suaves con su color. */
  .lector .callout {
    border-radius: var(--radius-card);
    border: 1px solid transparent;
    padding: 1em 1.25em;
    margin: 1.6em 0;
    font-size: 0.93em;
    line-height: 1.65;
  }
  .lector .callout p:last-child { margin-bottom: 0; }
  .lector .callout .callout-title {
    display: block;
    font-size: 0.78em;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 0.5em;
  }
  .lector .callout.concepto {
    background: var(--color-primary-light);
    border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  }
  .lector .callout.concepto .callout-title { color: var(--color-primary-dark); }
  .lector .callout.clinico {
    background: var(--color-success-soft);
    border-color: color-mix(in srgb, var(--color-success) 22%, transparent);
  }
  .lector .callout.clinico .callout-title { color: var(--color-success); }
  .lector .callout.etica {
    background: var(--color-warning-soft);
    border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
  }
  .lector .callout.etica .callout-title { color: var(--color-warning); }
  .lector .callout.alerta {
    background: var(--color-danger-soft);
    border-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
  }
  .lector .callout.alerta .callout-title { color: var(--color-danger); }

  /* Tablas: tarjeta con scroll horizontal propio en pantallas estrechas. */
  .lector .lector-tabla {
    overflow-x: auto;
    margin: 1.6em 0;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    background: var(--color-surface);
  }
  .lector table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88em;
    line-height: 1.5;
    margin: 0;
  }
  .lector th {
    background: var(--color-bg);
    color: var(--color-ink);
    text-align: left;
    font-weight: 600;
    padding: 0.65em 0.9em;
    border-bottom: 1px solid var(--color-line);
    min-width: 8rem;
  }
  .lector td {
    padding: 0.6em 0.9em;
    border-bottom: 1px solid var(--color-line);
    vertical-align: top;
    min-width: 8rem;
  }
  .lector tbody tr:nth-child(even) td { background: var(--color-bg); }
  .lector tr:last-child td { border-bottom: none; }

  /* Fuentes y lecturas: sección final limpia, sin URLs desbordadas. */
  .lector .sources {
    margin-top: 3.5em;
    padding-top: 1.6em;
    border-top: 2px solid var(--color-primary-light);
  }
  .lector .sources h1 {
    font-size: 1.22em;
    margin: 0 0 0.8em;
    padding-bottom: 0;
    border-bottom: none;
  }
  .lector .sources ol {
    font-size: 0.88em;
    color: var(--color-ink-soft);
    line-height: 1.65;
  }
  .lector .sources li {
    margin-bottom: 0.7em;
    overflow-wrap: anywhere;
  }
`;
