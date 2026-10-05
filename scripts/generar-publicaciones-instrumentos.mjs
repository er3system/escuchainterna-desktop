/**
 * Genera el HTML de imprenta de las publicaciones de "Pruebas e instrumentos" y la
 * referencia CIE-11 en data/publicaciones-src/html/. Luego se renderizan a PDF con
 * scripts/generar-pdfs.mjs y se registran en data/publicaciones/manifest.json.
 *
 * Contenido propio de EscuchaInterna. Los instrumentos incluidos (PHQ-9, GAD-7) son
 * de USO LIBRE / dominio público; el CIE-11 se arma desde nuestro propio dataset
 * (data/cie11/cie11.json). No se redistribuye ningún material con derechos de autor.
 *
 * Uso: node scripts/generar-publicaciones-instrumentos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'data/publicaciones-src/html');
fs.mkdirSync(SRC, { recursive: true });

const STYLE = `
  :root{--primary:#5b5bd6;--primary-dark:#4747b8;--primary-soft:#eeeefc;--ink:#1a1d27;--ink-soft:#5c6270;--line:#e5e7eb;--warm:#f8f7f4;}
  *{margin:0;padding:0;box-sizing:border-box;}
  html{font-size:11.5pt;}
  body{font-family:Georgia,'Times New Roman',serif;color:var(--ink);line-height:1.6;}
  @page{size:A4;margin:22mm 20mm 24mm 20mm;}
  @media print{.page-break{page-break-before:always;}.no-break{page-break-inside:avoid;}}
  .cover{height:250mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always;}
  .cover-band{height:6mm;background:linear-gradient(90deg,var(--primary),#8b8bf0);border-radius:3mm;}
  .cover-logo{display:flex;align-items:center;gap:10px;margin-top:14mm;}
  .cover-logo .wordmark{font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:20pt;font-weight:700;letter-spacing:-0.02em;}
  .cover-logo .wordmark b{color:var(--primary);}
  .cover-center{margin-top:18mm;}
  .cover-category{display:inline-block;font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:9.5pt;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary-dark);background:var(--primary-soft);padding:5px 14px;border-radius:999px;}
  .cover-title{font-size:30pt;line-height:1.18;font-weight:700;margin-top:10mm;max-width:150mm;}
  .cover-subtitle{font-size:13pt;color:var(--ink-soft);font-style:italic;margin-top:7mm;max-width:140mm;}
  .cover-footer{font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:9.5pt;color:var(--ink-soft);border-top:1px solid var(--line);padding-top:5mm;display:flex;justify-content:space-between;}
  .content h1{font-size:18pt;margin:12mm 0 5mm;padding-bottom:2.5mm;border-bottom:2.5px solid var(--primary);page-break-after:avoid;}
  .content h2{font-size:14pt;color:var(--primary-dark);margin:8mm 0 3mm;page-break-after:avoid;}
  .content h3{font-size:11.5pt;margin:5mm 0 2mm;page-break-after:avoid;}
  .content p{margin-bottom:3.4mm;text-align:justify;}
  .content ul,.content ol{margin:0 0 4mm 7mm;}
  .content li{margin-bottom:1.6mm;}
  .content strong{color:var(--ink);}
  .lead{font-size:12pt;color:var(--ink-soft);font-style:italic;border-left:3.5px solid var(--primary);padding-left:6mm;margin:6mm 0 8mm;}
  .callout{border-radius:4mm;padding:5mm 6mm;margin:5mm 0;page-break-inside:avoid;font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:10pt;line-height:1.5;}
  .callout .callout-title{font-weight:700;font-size:9pt;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:2mm;display:block;}
  .callout.concepto{background:var(--primary-soft);}.callout.concepto .callout-title{color:var(--primary-dark);}
  .callout.clinico{background:#e6f7f0;}.callout.clinico .callout-title{color:#1fa971;}
  .callout.etica{background:#fef3c7;}.callout.etica .callout-title{color:#b45309;}
  .callout.alerta{background:#fee2e2;}.callout.alerta .callout-title{color:#dc2626;}
  table{width:100%;border-collapse:collapse;margin:5mm 0;font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:9.5pt;page-break-inside:avoid;}
  th{background:var(--ink);color:white;text-align:left;padding:2.6mm 3.5mm;font-weight:600;}
  td{padding:2.4mm 3.5mm;border-bottom:1px solid var(--line);vertical-align:top;}
  tr:nth-child(even) td{background:var(--warm);}
  /* Instrumento autoaplicable: columnas de respuesta estrechas con casilla. */
  table.instr th.opt,table.instr td.opt{text-align:center;width:20mm;}
  table.instr td.opt{font-size:13pt;color:var(--primary-dark);}
  table.instr td.item{width:auto;}
  .scorebox{font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:9.5pt;}
  /* Árbol jerárquico del CIE-11. */
  .cie-list{font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:9.5pt;margin:4mm 0;}
  .cie-row{display:flex;gap:5mm;padding:1mm 0;border-bottom:1px solid #f0f0f3;page-break-inside:avoid;}
  .cie-code{flex:0 0 26mm;color:var(--primary-dark);font-weight:600;font-variant-numeric:tabular-nums;}
  .cie-title{flex:1;}
  .cie-block{margin-top:6mm;}
  .cie-block .cie-block-title{font-weight:700;color:var(--ink);font-size:10.5pt;margin:4mm 0 1mm;}
  .cie-l1{font-weight:600;}
  .cie-l2{padding-left:8mm;}
  .cie-l3{padding-left:16mm;color:var(--ink-soft);}
  .sources{margin-top:12mm;padding-top:5mm;border-top:2.5px solid var(--primary);}
  .sources h1{border:none;margin-top:0;}
  .sources ol{font-size:10pt;color:var(--ink-soft);margin-left:7mm;}
  .sources li{margin-bottom:2.5mm;}
  .doc-footer{margin-top:14mm;padding-top:5mm;border-top:1px solid var(--line);font-family:'Segoe UI',Inter,system-ui,sans-serif;font-size:8.5pt;color:var(--ink-soft);text-align:center;}
  /* ===== Hoja para entregar al paciente (última página, autosuficiente) ===== */
  /* Toda la hoja DEBE caber en una sola página: tipografía compacta y la tabla fluye
     justo bajo el encabezado (sin el page-break-inside:avoid global que la empujaría). */
  .entregable{page-break-before:always;font-family:'Segoe UI',Inter,system-ui,sans-serif;line-height:1.3;}
  .ent-band{height:4mm;background:linear-gradient(90deg,var(--primary),#8b8bf0);border-radius:3mm;margin-bottom:4mm;}
  .ent-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8mm;border-bottom:2px solid var(--primary);padding-bottom:2.5mm;margin-bottom:3mm;}
  .ent-brand{font-size:10pt;font-weight:700;color:var(--ink);letter-spacing:-0.01em;}
  .ent-brand b{color:var(--primary);}
  .ent-title{font-size:14pt;font-weight:700;margin-top:1mm;line-height:1.15;}
  .ent-fields{font-size:9pt;color:var(--ink-soft);white-space:nowrap;}
  .ent-fields div{margin-bottom:2.5mm;}
  .ent-line{display:inline-block;width:44mm;border-bottom:1px solid var(--ink-soft);margin-left:2mm;}
  .ent-line.short{width:26mm;}
  .ent-instr{font-size:9pt;line-height:1.4;background:var(--primary-soft);border-radius:3mm;padding:2.5mm 3.5mm;margin-bottom:3mm;color:var(--ink);}
  .ent-subhead{font-weight:700;color:var(--primary-dark);font-size:9.5pt;margin:3mm 0 1.5mm;}
  .entregable table.instr{font-size:8.5pt;margin:0 0 1mm;page-break-inside:auto;}
  .entregable table.instr tr{page-break-inside:avoid;}
  .entregable table.instr th{padding:1.6mm 3mm;font-size:7.5pt;}
  .entregable table.instr td{padding:1.3mm 3mm;}
  .entregable table.instr td.opt{font-size:11pt;}
  .entregable table.instr th.opt,.entregable table.instr td.opt{width:17mm;}
  .ent-impact{font-size:8.5pt;line-height:1.4;margin-top:2.5mm;padding:2mm 3mm;border:1px dashed var(--line);border-radius:3mm;}
  .ent-foot{margin-top:3mm;padding-top:2.5mm;border-top:1px solid var(--line);font-size:8pt;color:var(--ink-soft);}
`;

const LOGO_SVG = `<svg viewBox="0 0 88 88" width="42" height="42"><g fill="none" stroke="#5b5bd6" stroke-linecap="round"><path d="M44 14 a30 30 0 0 1 0 60" stroke-width="7"/><path d="M38 24 a20 20 0 0 1 0 40" stroke-width="6" opacity="0.75"/><path d="M32 34 a10 10 0 0 1 0 20" stroke-width="5" opacity="0.5"/></g><circle cx="22" cy="44" r="7" fill="#5b5bd6"/></svg>`;

const DATE_LABEL = 'Junio de 2026';

function buildHtml({ title, subtitle, category, body, sources, entregable }) {
  const sourcesHtml =
    sources && sources.length
      ? `<div class="sources"><h1>Fuentes</h1><ol>${sources.map((s) => `<li>${s}</li>`).join('')}</ol></div>`
      : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${title} — Colección EscuchaInterna</title>
<style>${STYLE}</style>
</head>
<body>
<section class="cover">
  <div>
    <div class="cover-band"></div>
    <div class="cover-logo">${LOGO_SVG}<span class="wordmark">escucha<b>interna</b></span></div>
    <div class="cover-center">
      <span class="cover-category">${category}</span>
      <h1 class="cover-title">${title}</h1>
      <p class="cover-subtitle">${subtitle}</p>
    </div>
  </div>
  <div class="cover-footer">
    <span>Colección EscuchaInterna · Material de referencia para profesionales</span>
    <span>${DATE_LABEL}</span>
  </div>
</section>
<main class="content">
${body}
${sourcesHtml}
<div class="doc-footer">Colección EscuchaInterna · Documento de referencia. No sustituye el juicio clínico ni los manuales oficiales de cada instrumento.</div>
</main>
${entregable ?? ''}
</body>
</html>`;
}

// ============================ PHQ-9 ============================
const PHQ9_ITEMS = [
  'Poco interés o placer en hacer las cosas',
  'Se ha sentido decaído/a, deprimido/a o sin esperanzas',
  'Dificultad para dormir o permanecer dormido/a, o ha dormido demasiado',
  'Se ha sentido cansado/a o con poca energía',
  'Poco apetito o ha comido en exceso',
  'Se ha sentido mal con usted mismo/a — o que es un fracaso, o que ha quedado mal con usted o con su familia',
  'Dificultad para concentrarse en cosas como leer el periódico o ver televisión',
  'Se ha movido o hablado tan lento que otras personas lo han notado; o lo contrario, ha estado tan inquieto/a que se ha movido mucho más de lo habitual',
  'Pensamientos de que estaría mejor muerto/a o de hacerse daño de alguna forma',
];
const FREQ_HEADERS = `<th class="opt">Ningún día (0)</th><th class="opt">Varios días (1)</th><th class="opt">Más de la mitad de los días (2)</th><th class="opt">Casi todos los días (3)</th>`;
function freqRows(items) {
  return items
    .map(
      (it, i) =>
        `<tr><td class="item">${i + 1}. ${it}</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td></tr>`,
    )
    .join('');
}

const PHQ9_BODY = `
<p class="lead">El PHQ-9 es un cuestionario breve, autoaplicable y de uso libre para el cribado y el seguimiento de la depresión. Mide la frecuencia de los nueve síntomas del episodio depresivo durante las últimas dos semanas. No es diagnóstico por sí solo: orienta y cuantifica, pero la decisión clínica siempre es del profesional.</p>

<h1>Cómo usarlo</h1>
<p>Entréguelo al consultante o adminístrelo en entrevista. Cubre las <strong>últimas dos semanas</strong>. Cada ítem puntúa de 0 a 3 según la frecuencia; el puntaje total (0–27) es la suma de los nueve ítems. Repetirlo a lo largo del proceso permite seguir la evolución de forma objetiva.</p>

<div class="callout alerta">
<span class="callout-title">Ítem 9 — seguridad</span>
Cualquier respuesta distinta de "Ningún día" en el ítem 9 (ideación de muerte o de autolesión) obliga a una evaluación de riesgo en profundidad antes de cerrar la sesión, con independencia del puntaje total.
</div>

<h1>Cuestionario</h1>
<p class="scorebox">Durante las <strong>últimas 2 semanas</strong>, ¿con qué frecuencia le han molestado los siguientes problemas? Marque una casilla por fila.</p>
<table class="instr">
<tr><th>Problema</th>${FREQ_HEADERS}</tr>
${freqRows(PHQ9_ITEMS)}
</table>

<h1>Puntuación e interpretación</h1>
<p>Sume los nueve ítems para obtener el <strong>puntaje total (0–27)</strong>:</p>
<table>
<tr><th>Puntaje</th><th>Gravedad de los síntomas depresivos</th></tr>
<tr><td>0–4</td><td>Mínima o ausente</td></tr>
<tr><td>5–9</td><td>Leve</td></tr>
<tr><td>10–14</td><td>Moderada</td></tr>
<tr><td>15–19</td><td>Moderadamente grave</td></tr>
<tr><td>20–27</td><td>Grave</td></tr>
</table>
<p>Como referencia, un puntaje de <strong>10 o más</strong> suele considerarse un punto de corte razonable para sospechar un episodio depresivo y profundizar la evaluación. Adapte el umbral a su contexto y a las validaciones disponibles para su país.</p>

<h2>Pregunta de impacto funcional</h2>
<p>Si marcó alguno de los problemas, ¿qué tanta dificultad le han causado para hacer su trabajo, ocuparse de las cosas de la casa o llevarse bien con otras personas?</p>
<ul>
<li>☐ Ninguna dificultad &nbsp;&nbsp; ☐ Alguna dificultad &nbsp;&nbsp; ☐ Mucha dificultad &nbsp;&nbsp; ☐ Muchísima dificultad</li>
</ul>

<div class="callout etica">
<span class="callout-title">Licencia</span>
El PHQ-9 fue desarrollado por los Dres. Spitzer, Williams y Kroenke con apoyo de Pfizer Inc. Es de <strong>uso libre</strong>: puede reproducirse, copiarse y emplearse sin solicitar permiso ni pagar regalías. Use versiones validadas en su país cuando estén disponibles.
</div>
`;

// ============================ GAD-7 ============================
const GAD7_ITEMS = [
  'Se ha sentido nervioso/a, ansioso/a o muy alterado/a',
  'No ha podido dejar de preocuparse o controlar la preocupación',
  'Se ha preocupado demasiado por diferentes cosas',
  'Ha tenido dificultad para relajarse',
  'Se ha sentido tan inquieto/a que le ha costado quedarse quieto/a',
  'Se ha molestado o irritado fácilmente',
  'Ha sentido miedo como si algo terrible fuera a pasar',
];
const GAD7_BODY = `
<p class="lead">El GAD-7 es una escala breve, autoaplicable y de uso libre para el cribado y el seguimiento de la ansiedad, especialmente del trastorno de ansiedad generalizada. Mide la frecuencia de siete síntomas durante las últimas dos semanas. Orienta y cuantifica; no reemplaza el juicio clínico.</p>

<h1>Cómo usarla</h1>
<p>Cubre las <strong>últimas dos semanas</strong>. Cada ítem puntúa de 0 a 3 según la frecuencia; el puntaje total (0–21) es la suma de los siete ítems. Es útil tanto en la evaluación inicial como para seguir la evolución a lo largo del tratamiento.</p>

<h1>Cuestionario</h1>
<p class="scorebox">Durante las <strong>últimas 2 semanas</strong>, ¿con qué frecuencia le han molestado los siguientes problemas? Marque una casilla por fila.</p>
<table class="instr">
<tr><th>Problema</th>${FREQ_HEADERS}</tr>
${freqRows(GAD7_ITEMS)}
</table>

<h1>Puntuación e interpretación</h1>
<p>Sume los siete ítems para obtener el <strong>puntaje total (0–21)</strong>:</p>
<table>
<tr><th>Puntaje</th><th>Gravedad de los síntomas de ansiedad</th></tr>
<tr><td>0–4</td><td>Mínima o ausente</td></tr>
<tr><td>5–9</td><td>Leve</td></tr>
<tr><td>10–14</td><td>Moderada</td></tr>
<tr><td>15–21</td><td>Grave</td></tr>
</table>
<p>Un puntaje de <strong>10 o más</strong> suele tomarse como punto de corte para sospechar un trastorno de ansiedad y profundizar la evaluación. Ajuste el umbral a su contexto y a las validaciones de su país.</p>

<div class="callout etica">
<span class="callout-title">Licencia</span>
El GAD-7 fue desarrollado por los Dres. Spitzer, Kroenke, Williams y Löwe con apoyo de Pfizer Inc. Es de <strong>uso libre</strong>: puede reproducirse y emplearse sin permiso ni regalías.
</div>
`;

// ===================== Goldberg (EADG) =====================
// Ítems verificados con dos fuentes oficiales (Servicio Canario de Salud y Hospital
// Universitario Virgen de las Nieves); validación española de Montón y cols. (1993).
const GOLDBERG_ANSIEDAD = [
  'Se ha sentido muy excitado, nervioso o en tensión',
  'Ha estado muy preocupado por algo',
  'Se ha sentido muy irritable',
  'Ha tenido dificultad para relajarse',
  'Ha dormido mal, ha tenido dificultades para dormir',
  'Ha tenido dolores de cabeza o de nuca',
  'Ha tenido alguno de estos síntomas: temblores, hormigueos, mareos, sudores, diarrea (síntomas vegetativos)',
  'Ha estado preocupado por su salud',
  'Ha tenido alguna dificultad para conciliar el sueño, para quedarse dormido',
];
const GOLDBERG_DEPRESION = [
  'Se ha sentido con poca energía',
  'Ha perdido el interés por las cosas',
  'Ha perdido la confianza en sí mismo',
  'Se ha sentido desesperanzado, sin esperanzas',
  'Ha tenido dificultades para concentrarse',
  'Ha perdido peso (a causa de su falta de apetito)',
  'Se ha estado despertando demasiado temprano',
  'Se ha sentido enlentecido',
  'Cree que ha tenido tendencia a encontrarse peor por las mañanas',
];
function sinoRows(items, screenNote) {
  return items
    .map((it, i) => {
      const row = `<tr><td class="item">${i + 1}. ¿${it}?</td><td class="opt">☐</td><td class="opt">☐</td></tr>`;
      return i === 3
        ? row +
            `<tr><td colspan="3" style="font-style:italic;color:#5c6270;font-size:8.5pt;padding:1.5mm 3.5mm;">${screenNote}</td></tr>`
        : row;
    })
    .join('');
}
const GOLDBERG_BODY = `
<p class="lead">La escala de Goldberg (EADG) es un instrumento breve y de uso libre para el cribado conjunto de la ansiedad y la depresión, muy usado en atención primaria. Es heteroadministrada: el profesional pregunta y registra. No diagnostica por sí sola; detecta probable malestar psíquico y orienta la evaluación.</p>

<h1>Cómo usarla</h1>
<p>Pregunte por los síntomas referidos a las <strong>últimas dos semanas</strong>. No se puntúan los síntomas de duración inferior a dos semanas ni los de intensidad leve. Cada respuesta afirmativa vale <strong>1 punto</strong>. Cada subescala tiene 9 ítems: los <strong>4 primeros son de despistaje</strong> y obligatorios; los <strong>5 últimos solo se formulan</strong> si hay suficientes respuestas afirmativas en los primeros.</p>

<div class="callout concepto">
<span class="callout-title">Regla de continuación</span>
Subescala de <strong>ansiedad</strong>: formule los ítems 5–9 solo si hay <strong>2 o más</strong> respuestas afirmativas en los ítems 1–4. Subescala de <strong>depresión</strong>: formule los ítems 5–9 solo si hay <strong>alguna</strong> respuesta afirmativa en los ítems 1–4.</p>
</div>

<h1>Subescala de ansiedad</h1>
<table class="instr"><tr><th>Pregunta</th><th class="opt">Sí</th><th class="opt">No</th></tr>
${sinoRows(GOLDBERG_ANSIEDAD, '(Continúe con los ítems 5–9 solo si hay 2 o más respuestas afirmativas en los ítems 1–4.)')}
</table>

<h1>Subescala de depresión</h1>
<table class="instr"><tr><th>Pregunta</th><th class="opt">Sí</th><th class="opt">No</th></tr>
${sinoRows(GOLDBERG_DEPRESION, '(Continúe con los ítems 5–9 solo si hay alguna respuesta afirmativa en los ítems 1–4.)')}
</table>

<h1>Puntuación e interpretación</h1>
<p>Sume las respuestas afirmativas de cada subescala por separado. Los puntos de corte habituales (validación española) son:</p>
<table>
<tr><th>Subescala</th><th>Punto de corte (probable caso)</th></tr>
<tr><td>Ansiedad</td><td>4 o más respuestas afirmativas</td></tr>
<tr><td>Depresión</td><td>2 o más respuestas afirmativas</td></tr>
</table>
<p>En población geriátrica se ha propuesto su uso como <strong>escala única</strong> (sumando ambas subescalas) con un punto de corte de 6 o más. Todos los ítems puntúan igual, pero siguen un orden de gravedad creciente: los últimos suelen aparecer en los cuadros más graves.</p>

<div class="callout etica">
<span class="callout-title">Licencia</span>
La escala de Goldberg es un instrumento de <strong>uso libre</strong>. Esta versión en español corresponde a la validación de Montón y cols. (1993). Úsala junto con el juicio clínico y la entrevista.
</div>
`;

// ===================== Zung (EAA / SAS) =====================
// Ítems y puntuación invertida (5, 9, 13, 17, 19) verificados con dos fuentes
// independientes. Instrumento de dominio público (Zung, 1965/1971).
const ZUNG_ITEMS = [
  'Me siento más nervioso/a y ansioso/a que de costumbre',
  'Me siento con temor sin razón',
  'Me molesto o me asusto con facilidad',
  'Siento que me derrumbo o que me hago pedazos',
  'Siento que todo está bien y que nada malo va a pasar',
  'Me tiemblan los brazos y las piernas',
  'Me molestan dolores de cabeza, de cuello o de espalda',
  'Me siento débil y me canso con facilidad',
  'Me siento tranquilo/a y puedo permanecer en calma con facilidad',
  'Siento que el corazón me late deprisa (palpitaciones)',
  'Me molestan los mareos',
  'Tengo desmayos o siento que me voy a desmayar',
  'Puedo respirar con facilidad',
  'Siento entumecimiento u hormigueo en los dedos de las manos y los pies',
  'Me molestan dolores de estómago o náuseas',
  'Tengo que orinar con más frecuencia de lo habitual',
  'Generalmente tengo las manos secas y calientes',
  'Se me enrojece la cara, me ruborizo',
  'Me duermo con facilidad y descanso bien durante la noche',
  'Tengo pesadillas',
];
const ZUNG_REVERSE = new Set([5, 9, 13, 17, 19]);
const ZUNG_HEADERS = `<th class="opt">Nada o poco del tiempo</th><th class="opt">Una parte del tiempo</th><th class="opt">Buena parte del tiempo</th><th class="opt">La mayor parte o todo el tiempo</th>`;
function zungRows(items) {
  return items
    .map(
      (it, i) =>
        `<tr><td class="item">${i + 1}. ${it}${ZUNG_REVERSE.has(i + 1) ? ' <strong>*</strong>' : ''}</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td></tr>`,
    )
    .join('');
}
const ZUNG_BODY = `
<p class="lead">La Escala de Autoevaluación de la Ansiedad de Zung (EAA / SAS) es un cuestionario autoaplicable y de dominio público que mide la intensidad de los síntomas de ansiedad —somáticos y cognitivo-afectivos— durante los últimos días. Cuantifica y permite seguir la evolución; no sustituye el juicio clínico.</p>

<h1>Cómo usarla</h1>
<p>La persona responde cada ítem según la frecuencia con que ha experimentado el síntoma, en una escala de 1 a 4 (de "Nada o poco del tiempo" a "La mayor parte o todo el tiempo"). El puntaje total es la suma de los 20 ítems (rango 20–80). <strong>Cinco ítems son de puntuación invertida</strong> (marcados con <strong>*</strong>): los 5, 9, 13, 17 y 19, redactados en sentido positivo, se puntúan al revés (4→1, 3→2, 2→3, 1→4).</p>

<h1>Cuestionario</h1>
<p class="scorebox">Indique con qué frecuencia ha sentido cada uno de los siguientes síntomas <strong>en los últimos días</strong>. Marque una casilla por fila.</p>
<table class="instr"><tr><th>Síntoma</th>${ZUNG_HEADERS}</tr>
${zungRows(ZUNG_ITEMS)}
</table>
<p style="font-size:9pt;color:#5c6270;"><strong>*</strong> Ítems de puntuación invertida (5, 9, 13, 17 y 19): asigne 4 puntos a "Nada o poco del tiempo" y 1 punto a "La mayor parte o todo el tiempo".</p>

<h1>Puntuación e interpretación</h1>
<p>Sume los 20 ítems (recordando invertir los marcados). El puntaje total se interpreta así:</p>
<table>
<tr><th>Puntaje total</th><th>Nivel de ansiedad</th></tr>
<tr><td>20–44</td><td>Dentro de límites normales</td></tr>
<tr><td>45–59</td><td>Ansiedad leve a moderada</td></tr>
<tr><td>60–74</td><td>Ansiedad marcada a severa</td></tr>
<tr><td>75–80</td><td>Ansiedad en grado máximo</td></tr>
</table>

<div class="callout etica">
<span class="callout-title">Licencia</span>
La escala de Zung es un instrumento de <strong>dominio público</strong> (W. W. K. Zung, 1965/1971). Las traducciones al español varían ligeramente en la redacción; usa, cuando exista, una versión validada para tu población.
</div>
`;

// ===================== DASS-21 =====================
// Ítems (versión en español) y asignación a subescalas verificados con dos fuentes
// independientes (artículo de validación + repositorio clínico). Uso libre clínico
// e investigador (Lovibond & Lovibond); no debe alterarse la redacción.
const DASS21_ITEMS = [
  'Me ha costado mucho descargar la tensión',
  'Me di cuenta que tenía la boca seca',
  'No podía sentir ningún sentimiento positivo',
  'Se me hizo difícil respirar',
  'Se me hizo difícil tomar la iniciativa para hacer cosas',
  'Reaccioné exageradamente en ciertas situaciones',
  'Sentí que mis manos temblaban',
  'He sentido que estaba gastando una gran cantidad de energía',
  'Estaba preocupado por situaciones en las cuales podría tener pánico o hacer el ridículo',
  'He sentido que no había nada que me ilusionara',
  'Me he sentido inquieto',
  'Se me hizo difícil relajarme',
  'Me sentí triste y deprimido',
  'No toleré nada que no me permitiera continuar con lo que estaba haciendo',
  'Sentí que estaba al punto de pánico',
  'No me pude entusiasmar por nada',
  'Sentí que valía muy poco como persona',
  'He tendido a sentirme enfadado con facilidad',
  'Sentí los latidos de mi corazón a pesar de no haber hecho ningún esfuerzo físico',
  'Tuve miedo sin razón',
  'Sentí que la vida no tenía ningún sentido',
];
const DASS21_SUB = {
  Depresión: [3, 5, 10, 13, 16, 17, 21],
  Ansiedad: [2, 4, 7, 9, 15, 19, 20],
  Estrés: [1, 6, 8, 11, 12, 14, 18],
};
function dassTag(n) {
  if (DASS21_SUB.Depresión.includes(n)) return 'D';
  if (DASS21_SUB.Ansiedad.includes(n)) return 'A';
  return 'E';
}
function dassRows(items) {
  return items
    .map(
      (it, i) =>
        `<tr><td class="item"><strong style="color:#4747b8;">${dassTag(i + 1)}</strong>&nbsp; ${i + 1}. ${it}</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td></tr>`,
    )
    .join('');
}
const DASS21_BODY = `
<p class="lead">El DASS-21 mide la intensidad de tres estados emocionales relacionados: depresión, ansiedad y estrés. Son 21 afirmaciones (7 por subescala) referidas a la última semana, de uso libre en clínica e investigación. Cuantifica y discrimina entre los tres dominios; no diagnostica por sí solo.</p>

<h1>Cómo usarlo</h1>
<p>La persona indica cuánto le ha afectado cada afirmación <strong>durante la última semana</strong>, de 0 a 3. La letra a la izquierda de cada ítem indica su subescala: <strong>D</strong> (depresión), <strong>A</strong> (ansiedad), <strong>E</strong> (estrés). Sume los ítems de cada subescala por separado y <strong>multiplique cada total por 2</strong> (el DASS-21 es la versión corta del DASS-42; el ×2 permite comparar con los baremos).</p>
<p class="scorebox"><strong>0</strong> = No me ocurrió &nbsp;·&nbsp; <strong>1</strong> = Me ocurrió un poco, o durante parte del tiempo &nbsp;·&nbsp; <strong>2</strong> = Me ocurrió bastante, o durante buena parte del tiempo &nbsp;·&nbsp; <strong>3</strong> = Me ocurrió mucho, o la mayor parte del tiempo</p>

<h1>Cuestionario</h1>
<table class="instr"><tr><th>Durante la última semana…</th><th class="opt">0</th><th class="opt">1</th><th class="opt">2</th><th class="opt">3</th></tr>
${dassRows(DASS21_ITEMS)}
</table>

<h1>Puntuación e interpretación</h1>
<p>Subescalas (sume y multiplique cada una por 2): <strong>Depresión</strong> = ítems 3, 5, 10, 13, 16, 17, 21 · <strong>Ansiedad</strong> = 2, 4, 7, 9, 15, 19, 20 · <strong>Estrés</strong> = 1, 6, 8, 11, 12, 14, 18. Rangos de gravedad (puntaje ya multiplicado por 2):</p>
<table>
<tr><th>Gravedad</th><th>Depresión</th><th>Ansiedad</th><th>Estrés</th></tr>
<tr><td>Normal</td><td>0–9</td><td>0–7</td><td>0–14</td></tr>
<tr><td>Leve</td><td>10–13</td><td>8–9</td><td>15–18</td></tr>
<tr><td>Moderada</td><td>14–20</td><td>10–14</td><td>19–25</td></tr>
<tr><td>Severa</td><td>21–27</td><td>15–19</td><td>26–33</td></tr>
<tr><td>Extremadamente severa</td><td>28+</td><td>20+</td><td>34+</td></tr>
</table>

<div class="callout etica">
<span class="callout-title">Licencia</span>
El DASS es de <strong>uso libre</strong> en contextos clínicos y de investigación (Lovibond &amp; Lovibond, 1995); no requiere permiso, pero no debe alterarse la redacción de los ítems. Material y baremos oficiales en www2.psy.unsw.edu.au/dass.
</div>
`;

// ===================== Zung SDS (depresión) =====================
// Ítems y puntuación invertida (2,5,6,11,12,14,16,17,18,20) verificados con dos
// fuentes independientes. Instrumento de dominio público (Zung, 1965).
const ZUNG_SDS_ITEMS = [
  'Me siento decaído y triste',
  'Por la mañana es cuando me siento mejor',
  'Siento ganas de llorar o ganas de echarme a llorar',
  'Tengo problemas para dormir por la noche',
  'Como la misma cantidad de siempre',
  'Todavía disfruto del sexo',
  'He notado que estoy perdiendo peso',
  'Tengo problemas de estreñimiento',
  'Mi corazón late más rápido de lo normal',
  'Me canso sin razón alguna',
  'Mi mente está tan clara como siempre',
  'Me resulta fácil hacer las cosas que solía hacer',
  'Me siento agitado/a y no puedo estar quieto/a',
  'Siento esperanza en el futuro',
  'Estoy más irritable de lo normal',
  'Me resulta fácil tomar decisiones',
  'Siento que soy útil y que me necesitan',
  'Mi vida es bastante plena',
  'Siento que los demás estarían mejor si yo no estuviera',
  'Todavía disfruto de las cosas que disfrutaba antes',
];
const ZUNG_SDS_REVERSE = new Set([2, 5, 6, 11, 12, 14, 16, 17, 18, 20]);
const ZUNG_SDS_HEADERS = `<th class="opt">Poco tiempo</th><th class="opt">Algo de tiempo</th><th class="opt">Buena parte del tiempo</th><th class="opt">La mayor parte del tiempo</th>`;
function zungSdsRows(items) {
  return items
    .map(
      (it, i) =>
        `<tr><td class="item">${i + 1}. ${it}${ZUNG_SDS_REVERSE.has(i + 1) ? ' <strong>*</strong>' : ''}</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td><td class="opt">☐</td></tr>`,
    )
    .join('');
}
const ZUNG_SDS_BODY = `
<p class="lead">La Escala de Autoevaluación de la Depresión de Zung (SDS) es un cuestionario autoaplicable y de dominio público que mide la intensidad de los síntomas depresivos. Veinte ítems cubren las dimensiones afectiva, somática, psicomotora y psicológica de la depresión. Cuantifica la gravedad; no sustituye el juicio clínico.</p>

<h1>Cómo usarla</h1>
<p>La persona responde con qué frecuencia ha experimentado cada síntoma últimamente, de 1 a 4 (de "Poco tiempo" a "La mayor parte del tiempo"). <strong>Diez ítems son de puntuación invertida</strong> (marcados con <strong>*</strong>): los 2, 5, 6, 11, 12, 14, 16, 17, 18 y 20, redactados en sentido positivo, se puntúan al revés (4→1, 3→2, 2→3, 1→4).</p>

<h1>Cuestionario</h1>
<p class="scorebox">Indique con qué frecuencia se ha sentido así <strong>últimamente</strong>. Marque una casilla por fila.</p>
<table class="instr"><tr><th>Afirmación</th>${ZUNG_SDS_HEADERS}</tr>
${zungSdsRows(ZUNG_SDS_ITEMS)}
</table>
<p style="font-size:9pt;color:#5c6270;"><strong>*</strong> Ítems de puntuación invertida (2, 5, 6, 11, 12, 14, 16, 17, 18 y 20): asigne 4 puntos a "Poco tiempo" y 1 a "La mayor parte del tiempo".</p>

<h1>Puntuación e interpretación</h1>
<p>Sume los 20 ítems (recordando invertir los marcados): el <strong>puntaje bruto</strong> va de 20 a 80. La forma más usada es convertirlo a un <strong>índice SDS</strong> = (puntaje bruto ÷ 80) × 100, que va de 25 a 100:</p>
<table>
<tr><th>Índice SDS</th><th>Nivel de depresión</th></tr>
<tr><td>Menos de 50</td><td>Dentro de límites normales</td></tr>
<tr><td>50–59</td><td>Depresión leve</td></tr>
<tr><td>60–69</td><td>Depresión moderada</td></tr>
<tr><td>70 o más</td><td>Depresión grave</td></tr>
</table>

<div class="callout etica">
<span class="callout-title">Licencia</span>
La escala de Zung es de <strong>dominio público</strong> (W. W. K. Zung, 1965). Las traducciones al español varían ligeramente; usa, cuando exista, una versión validada para tu población.
</div>
`;

// ===================== Hoja para entregar al paciente =====================
// La última página de cada instrumento es una versión LIMPIA y autosuficiente del
// cuestionario, pensada para imprimir esa sola hoja y entregársela al consultante (o,
// en los heteroadministrados, como hoja de registro del profesional). Sin "cómo usar",
// interpretación ni marcas de puntuación: eso vive en las páginas anteriores, para el
// profesional. Reutiliza los mismos ítems verificados.
const optCells = (n) => '<td class="opt">☐</td>'.repeat(n);
const entRows = (items, n, wrap = (t) => t) =>
  items.map((it, i) => `<tr><td class="item">${i + 1}. ${wrap(it)}</td>${optCells(n)}</tr>`).join('');
const optHeaders = (labels) => labels.map((l) => `<th class="opt">${l}</th>`).join('');

function buildEntregable({ title, instruction, sections, impact, footnote, score }) {
  const body = sections
    .map(
      (s) =>
        `${s.subhead ? `<p class="ent-subhead">${s.subhead}</p>` : ''}<table class="instr"><tr><th>${s.firstCol}</th>${s.headers}</tr>${s.rows}</table>`,
    )
    .join('');
  return `<section class="entregable">
  <div class="ent-band"></div>
  <header class="ent-head">
    <div><div class="ent-brand">escucha<b>interna</b></div><h2 class="ent-title">${title}</h2></div>
    <div class="ent-fields"><div>Nombre <span class="ent-line"></span></div><div>Fecha <span class="ent-line short"></span></div></div>
  </header>
  <p class="ent-instr">${instruction}</p>
  ${body}
  ${impact ? `<div class="ent-impact">${impact}</div>` : ''}
  <div class="ent-foot"><span>${footnote}</span>${score ? `<span class="ent-score">${score}</span>` : ''}</div>
</section>`;
}

const FREQ_LABELS = ['Ningún día', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'];

const PHQ9_ENTREGABLE = buildEntregable({
  title: 'PHQ-9 · Cuestionario sobre la salud',
  instruction:
    'Durante las <strong>últimas 2 semanas</strong>, ¿con qué frecuencia le han molestado los siguientes problemas? Marque una casilla por fila.',
  sections: [{ firstCol: 'Problema', headers: optHeaders(FREQ_LABELS), rows: entRows(PHQ9_ITEMS, 4) }],
  impact:
    'Si marcó algún problema, ¿qué tanta dificultad le han causado para su trabajo, su casa o llevarse con otras personas? &nbsp; ☐ Ninguna &nbsp; ☐ Alguna &nbsp; ☐ Mucha &nbsp; ☐ Muchísima',
  footnote: 'PHQ-9 · Instrumento de uso libre. No sustituye el juicio clínico.',
});

const GAD7_ENTREGABLE = buildEntregable({
  title: 'GAD-7 · Escala de ansiedad',
  instruction:
    'Durante las <strong>últimas 2 semanas</strong>, ¿con qué frecuencia le han molestado los siguientes problemas? Marque una casilla por fila.',
  sections: [{ firstCol: 'Problema', headers: optHeaders(FREQ_LABELS), rows: entRows(GAD7_ITEMS, 4) }],
  footnote: 'GAD-7 · Instrumento de uso libre. No sustituye el juicio clínico.',
});

const GOLDBERG_ENTREGABLE = buildEntregable({
  title: 'Escala de Goldberg (EADG)',
  instruction:
    'Marque <strong>Sí</strong> o <strong>No</strong> según los síntomas de las <strong>últimas 2 semanas</strong>. La aplica el profesional; los ítems 5–9 de cada bloque solo se preguntan si hubo suficientes «Sí» en los cuatro primeros.',
  sections: [
    {
      subhead: 'Subescala de ansiedad',
      firstCol: 'Pregunta',
      headers: optHeaders(['Sí', 'No']),
      rows: entRows(GOLDBERG_ANSIEDAD, 2, (t) => `¿${t}?`),
    },
    {
      subhead: 'Subescala de depresión',
      firstCol: 'Pregunta',
      headers: optHeaders(['Sí', 'No']),
      rows: entRows(GOLDBERG_DEPRESION, 2, (t) => `¿${t}?`),
    },
  ],
  footnote: 'Escala de Goldberg · Uso libre (validación española, Montón y cols., 1993).',
});

const ZUNG_SAS_LABELS = [
  'Nada o poco del tiempo',
  'Una parte del tiempo',
  'Buena parte del tiempo',
  'La mayor parte o todo el tiempo',
];
const ZUNG_SAS_ENTREGABLE = buildEntregable({
  title: 'Escala de Zung (SAS) · Ansiedad',
  instruction:
    'Indique con qué frecuencia ha sentido cada síntoma <strong>en los últimos días</strong>. Marque una casilla por fila.',
  sections: [{ firstCol: 'Síntoma', headers: optHeaders(ZUNG_SAS_LABELS), rows: entRows(ZUNG_ITEMS, 4) }],
  footnote: 'Escala de Zung (SAS) · Dominio público. No sustituye el juicio clínico.',
});

const ZUNG_SDS_LABELS = [
  'Poco tiempo',
  'Algo de tiempo',
  'Buena parte del tiempo',
  'La mayor parte del tiempo',
];
const ZUNG_SDS_ENTREGABLE = buildEntregable({
  title: 'Escala de Zung (SDS) · Depresión',
  instruction:
    'Indique con qué frecuencia se ha sentido así <strong>últimamente</strong>. Marque una casilla por fila.',
  sections: [{ firstCol: 'Afirmación', headers: optHeaders(ZUNG_SDS_LABELS), rows: entRows(ZUNG_SDS_ITEMS, 4) }],
  footnote: 'Escala de Zung (SDS) · Dominio público. No sustituye el juicio clínico.',
});

const DASS21_LABELS = ['No me ocurrió', 'Un poco', 'Bastante', 'Mucho'];
const DASS21_ENTREGABLE = buildEntregable({
  title: 'DASS-21 · Depresión, ansiedad y estrés',
  instruction:
    'Indique cuánto le afectó cada afirmación <strong>durante la última semana</strong>. Marque una casilla por fila.',
  sections: [
    { firstCol: 'Durante la última semana…', headers: optHeaders(DASS21_LABELS), rows: entRows(DASS21_ITEMS, 4) },
  ],
  footnote: 'DASS-21 · Uso libre (Lovibond & Lovibond). No altere la redacción de los ítems.',
});

// ===================== Guía de tests psicológicos =====================
const GUIA_BODY = `
<p class="lead">No todos los instrumentos psicológicos se pueden compartir libremente. Algunos son de uso abierto; otros están protegidos por derechos de autor y solo deben usarse con la versión oficial, adquirida a su editorial. Esta guía explica qué mide cada prueba de uso frecuente en el ámbito hispanohablante, cuál es su situación de licencia y dónde conseguir la versión válida — sin reproducir aquí ningún material protegido.</p>

<div class="callout concepto">
<span class="callout-title">Por qué esto importa</span>
Usar una fotocopia o un PDF no autorizado de un test con derechos de autor puede invalidar los resultados (versiones recortadas o mal traducidas) y expone a problemas legales y éticos. La buena práctica es emplear siempre la versión oficial y validada en tu país, respetar las condiciones de uso y registrar en el expediente qué instrumento, versión y baremo se aplicaron.</p>
</div>

<h1>Instrumentos de uso libre</h1>
<p>Pueden reproducirse y aplicarse sin permiso ni pago. Aun así, conviene usar versiones validadas para tu población y citar la fuente.</p>
<table>
<tr><th>Instrumento</th><th>Qué mide</th><th>Dónde conseguirlo</th></tr>
<tr><td><strong>PHQ-9</strong></td><td>Cribado y seguimiento de depresión (9 ítems)</td><td>Disponible como descargable en esta misma biblioteca. Versiones oficiales en phqscreeners.com</td></tr>
<tr><td><strong>GAD-7</strong></td><td>Cribado y seguimiento de ansiedad (7 ítems)</td><td>Disponible en esta biblioteca. Versiones oficiales en phqscreeners.com</td></tr>
<tr><td><strong>Escala de Goldberg (EADG)</strong></td><td>Cribado conjunto de ansiedad y depresión (subescalas de 9 ítems)</td><td>Disponible como descargable en esta misma biblioteca (validación española de Montón y cols., 1993)</td></tr>
<tr><td><strong>Escala de Zung (SAS y SDS)</strong></td><td>Autoevaluación de la ansiedad (SAS) y de la depresión (SDS), 20 ítems cada una</td><td>Ambas disponibles como descargables en esta biblioteca (dominio público, Zung)</td></tr>
<tr><td><strong>DASS-21</strong></td><td>Depresión, ansiedad y estrés (21 ítems)</td><td>Disponible como descargable en esta biblioteca (uso libre, Lovibond &amp; Lovibond)</td></tr>
<tr><td><strong>AUDIT</strong></td><td>Detección de consumo de riesgo de alcohol (10 ítems)</td><td>Publicado por la OMS (uso libre, pero no comercial). Descárgalo de la web oficial de la OMS o del Ministerio de Sanidad (sanidad.gob.es)</td></tr>
</table>
<p>Si quieres que añadamos alguno de estos como descargable propio en la biblioteca (con su hoja de puntuación), avísanos: incorporamos solo versiones de uso libre verificadas.</p>

<h1>Instrumentos con derechos de autor</h1>
<p>Requieren compra de la versión oficial a su editorial. No los reproducimos aquí; indicamos qué miden y dónde adquirirlos.</p>

<h2>Inventarios de Beck (BDI-II y BAI)</h2>
<p>El <strong>Inventario de Depresión de Beck-II (BDI-II)</strong> y el <strong>Inventario de Ansiedad de Beck (BAI)</strong> son autoinformes de 21 ítems muy usados para medir la intensidad de síntomas depresivos y ansiosos, respectivamente. Están protegidos por derechos de autor (Pearson Clinical) y deben adquirirse oficialmente: el manual y los cuadernillos se compran en <strong>Pearson Clinical</strong> (y en distribuidores como TEA Ediciones en España y sus representantes en Latinoamérica). Fotocopiar o usar versiones no autorizadas no está permitido.</p>

<h2>Tests proyectivos (Rorschach, Bender, figura humana, persona bajo la lluvia, familia)</h2>
<p>Las <strong>láminas, cuadernillos y manuales de aplicación e interpretación</strong> de estos instrumentos están protegidos por derechos de autor de sus editoriales. La consigna gráfica básica de algunos tests de dibujo (por ejemplo, "dibuje una persona") es de uso común, pero los <strong>sistemas de puntuación e interpretación</strong> (Koppitz para Bender, los manuales de Machover, de Persona bajo la lluvia o del Test de la familia, y muy especialmente las láminas del Rorschach) deben usarse en su versión oficial. Consíguelos en sus editoriales (p. ej. Hogrefe, TEA Ediciones, Paidós, Manual Moderno) o en distribuidores autorizados de tu país.</p>

<h2>Inventarios y escalas con licencia (Coopersmith, CDI y otros)</h2>
<p>Instrumentos como el <strong>Inventario de Autoestima de Coopersmith</strong> o el <strong>Inventario de Depresión Infantil (CDI, de Kovacs)</strong> también están protegidos. Adquiérelos a través de sus editoriales (por ejemplo, Manual Moderno o TEA Ediciones) en su versión validada.</p>

<div class="callout clinico">
<span class="callout-title">Buenas prácticas al aplicar pruebas</span>
Las pruebas formales se administran y puntúan según el manual de cada instrumento, casi siempre de forma presencial y por un profesional capacitado. Registra en el expediente el nombre del instrumento, la versión, la fecha y el resultado (usa el tipo de sesión "Prueba aplicada"). Interpreta siempre con el baremo correspondiente a la población y comunica los resultados de forma cuidadosa, integrándolos con el resto de la evaluación.</p>
</div>
`;

// ============================ CIE-11 ============================
function cie11Body() {
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/cie11/cie11.json'), 'utf-8'));
  const escape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let html = `
<p class="lead">La CIE-11 (Clasificación Internacional de Enfermedades, 11.ª revisión, de la Organización Mundial de la Salud) es el sistema de referencia para codificar diagnósticos. Este documento reúne los códigos y títulos de los capítulos más relevantes para la práctica psicológica, en español, como guía rápida de consulta. Para las descripciones clínicas completas y los criterios diagnósticos, consulta siempre el navegador oficial de la OMS.</p>

<div class="callout concepto">
<span class="callout-title">Cómo leer los códigos</span>
Cada categoría tiene un código alfanumérico (p. ej. <strong>6A70</strong> = Trastorno depresivo de episodio único). Los subtipos añaden un punto y un dígito (6A70.0, 6A70.1…). Los bloques agrupadores (sin código de categoría) organizan el capítulo por familias de trastornos. Esta referencia no reemplaza al texto oficial: el diagnóstico exige cumplir los criterios descritos por la OMS.</p>
</div>
`;
  const byChapter = new Map();
  for (const ch of raw.chapters) byChapter.set(ch.id, { title: ch.title, entries: [] });
  for (const e of raw.entries) {
    if (byChapter.has(e.chapter)) byChapter.get(e.chapter).entries.push(e);
  }
  for (const [, ch] of byChapter) {
    html += `<h1>${escape(ch.title)}</h1>\n<div class="cie-list">`;
    for (const e of ch.entries) {
      const isBlock = String(e.code).startsWith('BLOCK');
      if (isBlock) {
        html += `<div class="cie-block"><div class="cie-block-title">${escape(e.title)}</div></div>`;
      } else {
        const lvl = e.level <= 1 ? 'cie-l1' : e.level === 2 ? 'cie-l2' : 'cie-l3';
        html += `<div class="cie-row ${lvl}"><span class="cie-code">${escape(e.code)}</span><span class="cie-title">${escape(e.title)}</span></div>`;
      }
    }
    html += `</div>\n`;
  }
  return html;
}

// ============================ Publicaciones ============================
const PUBS = [
  {
    id: 'cie11-salud-mental',
    title: 'CIE-11 · Capítulos de salud mental',
    subtitle: 'Códigos y títulos para consulta rápida (trastornos mentales, sueño-vigilia y salud sexual)',
    category: 'Marcos normativos',
    country: '',
    kind: 'marco_normativo',
    summary:
      'Referencia rápida de los códigos y títulos de la CIE-11 (OMS) en los capítulos más usados en psicología: trastornos mentales, del comportamiento o del neurodesarrollo; del ciclo sueño-vigilia; y condiciones relacionadas con la salud sexual. Para los criterios completos, consulta el navegador oficial de la OMS.',
    body: cie11Body(),
    sources: [
      'Organización Mundial de la Salud. Clasificación Internacional de Enfermedades, 11.ª revisión (CIE-11 MMS, versión en español, 2024). https://icd.who.int/browse11/l-m/es',
    ],
  },
  {
    id: 'phq-9',
    title: 'PHQ-9 · Cuestionario sobre la salud del paciente',
    subtitle: 'Instrumento de uso libre para el cribado y seguimiento de la depresión',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Cuestionario breve, autoaplicable y de uso libre (dominio público) para el cribado y el seguimiento de la depresión: 9 ítems, puntaje 0–27, con su hoja de puntuación e interpretación. Listo para imprimir y aplicar. La última página es una hoja del cuestionario lista para imprimir y entregar al paciente.',
    body: PHQ9_BODY,
    entregable: PHQ9_ENTREGABLE,
    sources: [
      'Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001;16(9):606–613.',
      'Pfizer Inc. Patient Health Questionnaire (PHQ) Screeners — uso libre. www.phqscreeners.com',
    ],
  },
  {
    id: 'gad-7',
    title: 'GAD-7 · Escala de ansiedad generalizada',
    subtitle: 'Instrumento de uso libre para el cribado y seguimiento de la ansiedad',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Escala breve, autoaplicable y de uso libre (dominio público) para el cribado y el seguimiento de la ansiedad: 7 ítems, puntaje 0–21, con su hoja de puntuación e interpretación. Lista para imprimir y aplicar. La última página es una hoja del cuestionario lista para imprimir y entregar al paciente.',
    body: GAD7_BODY,
    entregable: GAD7_ENTREGABLE,
    sources: [
      'Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006;166(10):1092–1097.',
      'Pfizer Inc. Patient Health Questionnaire (PHQ) Screeners — uso libre. www.phqscreeners.com',
    ],
  },
  {
    id: 'goldberg-eadg',
    title: 'Escala de Goldberg (EADG) · Ansiedad y depresión',
    subtitle: 'Instrumento de uso libre para el cribado conjunto de ansiedad y depresión',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Escala breve y de uso libre para el cribado conjunto de ansiedad y depresión en atención primaria (validación española de Montón y cols., 1993): dos subescalas de 9 ítems (Sí/No), con su regla de despistaje, puntos de corte e interpretación. Ítems verificados con fuentes oficiales. La última página es una hoja de registro del cuestionario, lista para imprimir.',
    body: GOLDBERG_BODY,
    entregable: GOLDBERG_ENTREGABLE,
    sources: [
      'Goldberg D, Bridges K, Duncan-Jones P, Grayson D. Detecting anxiety and depression in general medical settings. BMJ. 1988;297:897–899.',
      'Montón C, Pérez-Echeverría MJ, Campos R, et al. Escalas de ansiedad y depresión de Goldberg: una guía de entrevista eficaz para la detección del malestar psíquico. Aten Primaria. 1993;12(6):345–349.',
      'Servicio Canario de Salud / Hospital Universitario Virgen de las Nieves. Cribado de ansiedad y depresión — escala de Goldberg (documentos institucionales).',
    ],
  },
  {
    id: 'zung-ansiedad',
    title: 'Escala de Zung (EAA / SAS) · Autoevaluación de la ansiedad',
    subtitle: 'Instrumento autoaplicable de dominio público para medir la intensidad de la ansiedad',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Cuestionario autoaplicable de 20 ítems (dominio público, Zung 1971) que mide la intensidad de la ansiedad: escala de frecuencia 1–4, con sus cinco ítems de puntuación invertida (5, 9, 13, 17, 19), rango 20–80 e interpretación. Ítems verificados con dos fuentes independientes. La última página es una hoja del cuestionario lista para imprimir y entregar al paciente.',
    body: ZUNG_BODY,
    entregable: ZUNG_SAS_ENTREGABLE,
    sources: [
      'Zung WWK. A rating instrument for anxiety disorders. Psychosomatics. 1971;12(6):371–379.',
      'Versión en español de la Escala de Autoevaluación de la Ansiedad de Zung (SAS); ítems y puntuación invertida verificados con fuentes independientes.',
    ],
  },
  {
    id: 'dass-21',
    title: 'DASS-21 · Depresión, ansiedad y estrés',
    subtitle: 'Instrumento de uso libre que mide tres estados emocionales en 21 ítems',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Escala de 21 ítems (uso libre, Lovibond & Lovibond) que mide depresión, ansiedad y estrés en tres subescalas de 7 ítems. Incluye los ítems en español, su asignación a subescalas, el ×2 y los rangos de gravedad. Ítems y subescalas verificados con dos fuentes. La última página es una hoja del cuestionario lista para imprimir y entregar al paciente.',
    body: DASS21_BODY,
    entregable: DASS21_ENTREGABLE,
    sources: [
      'Lovibond SH, Lovibond PF. Manual for the Depression Anxiety Stress Scales (DASS). 2.ª ed. Sydney: Psychology Foundation; 1995. www2.psy.unsw.edu.au/dass',
      'Román Mella F, Vinet EV, Alarcón Muñoz AM. Escalas de Depresión, Ansiedad y Estrés (DASS-21): adaptación y propiedades psicométricas. (validación en español).',
    ],
  },
  {
    id: 'zung-depresion',
    title: 'Escala de Zung (SDS) · Autoevaluación de la depresión',
    subtitle: 'Instrumento autoaplicable de dominio público para medir la gravedad de la depresión',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Cuestionario autoaplicable de 20 ítems (dominio público, Zung 1965) que mide la intensidad de los síntomas depresivos: frecuencia 1–4, con sus diez ítems de puntuación invertida, el índice SDS y la interpretación. Ítems y puntuación verificados con dos fuentes independientes. La última página es una hoja del cuestionario lista para imprimir y entregar al paciente.',
    body: ZUNG_SDS_BODY,
    entregable: ZUNG_SDS_ENTREGABLE,
    sources: [
      'Zung WWK. A Self-Rating Depression Scale. Arch Gen Psychiatry. 1965;12:63–70.',
      'Versión en español de la Escala de Autoevaluación de la Depresión de Zung (SDS); ítems y puntuación invertida verificados con fuentes independientes.',
    ],
  },
  {
    id: 'guia-tests-psicologicos',
    title: 'Pruebas psicológicas: qué miden y dónde conseguirlas',
    subtitle: 'Instrumentos de uso libre y con derechos de autor, con sus fuentes oficiales',
    category: 'Pruebas e instrumentos',
    country: '',
    kind: 'tema',
    summary:
      'Guía práctica de los instrumentos más usados en el ámbito hispanohablante: qué mide cada uno, cuál es de uso libre y cuál tiene derechos de autor, y dónde conseguir la versión oficial y validada. Sin reproducir material protegido.',
    body: GUIA_BODY,
    sources: [
      'Beck AT, Steer RA, Brown GK. Manual del Inventario de Depresión de Beck-II (BDI-II). Pearson.',
      'Lovibond SH, Lovibond PF. Depression Anxiety Stress Scales (DASS). www2.psy.unsw.edu.au/dass',
      'Montón C, et al. Escalas de ansiedad y depresión de Goldberg: una guía de entrevista eficaz para la detección del malestar psíquico. Aten Primaria. 1993;12(6):345–349.',
    ],
  },
];

for (const p of PUBS) {
  const file = path.join(SRC, `${p.id}.html`);
  fs.writeFileSync(file, buildHtml(p), 'utf-8');
  console.log(`OK ${p.id}.html`);
}

// Emite el manifest parcial (para copiar a data/publicaciones/manifest.json).
const manifestEntries = PUBS.map((p) => ({
  id: p.id,
  title: p.title,
  summary: p.summary,
  category: p.category,
  kind: p.kind,
  country: p.country,
  htmlPath: `data/publicaciones-src/html/${p.id}.html`,
  pdfPath: `data/publicaciones/pdf/${p.id}.pdf`,
  sources: p.sources,
}));
fs.writeFileSync(
  path.resolve(process.cwd(), 'data/publicaciones/_nuevas-entradas.json'),
  JSON.stringify(manifestEntries, null, 2),
  'utf-8',
);
console.log(`\n${PUBS.length} publicaciones generadas. Entradas de manifest en data/publicaciones/_nuevas-entradas.json`);
