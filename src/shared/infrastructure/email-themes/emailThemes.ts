/**
 * Temas visuales de correo (módulo PURO: importable desde client components).
 *
 * Cada tema es una función pura (contenido + datos del profesional/organización)
 * → HTML completo del correo, con estilos inline y maquetado con tablas aptos
 * para clientes de correo (Gmail, Outlook, Apple Mail). El protagonista visual
 * es el PROFESIONAL: su nombre (y el logo de su organización si lo tiene)
 * encabezan y firman el correo. EscuchaInterna aparece solo como una línea
 * discreta al pie.
 *
 * El contenido se recibe como texto plano (el mismo que se compone en la app);
 * aquí se escapa, se convierten los saltos de línea y se enlazan las URLs.
 * Si el contenido trae una liga de acción (pago/sesión), se ofrece además un
 * botón destacado mediante el campo opcional `action`.
 */

export type EmailThemeId = 'calido' | 'profesional' | 'minimal';

export interface EmailThemeInfo {
  id: EmailThemeId;
  name: string;
  description: string;
}

export const EMAIL_THEMES: EmailThemeInfo[] = [
  {
    id: 'calido',
    name: 'Cálido',
    description: 'Tonos crema y tipografía serif: cercano y acogedor.',
  },
  {
    id: 'profesional',
    name: 'Profesional',
    description: 'Encabezado salvia y tipografía sans: formal y claro.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Blanco y gris: sobrio, sin distracciones.',
  },
];

export const DEFAULT_EMAIL_THEME: EmailThemeId = 'calido';

export function isEmailThemeId(value: string): value is EmailThemeId {
  return value === 'calido' || value === 'profesional' || value === 'minimal';
}

export interface EmailSenderData {
  /** Nombre del profesional que firma el correo (remitente visual). */
  professionalName: string;
  /** Nombre de la organización a la que pertenece (opcional). */
  organizationName?: string;
  /** URL (o data URI) del logo de la organización (opcional). */
  organizationLogoUrl?: string;
  /** Botón de acción opcional (p. ej. "Ver mi sesión" / "Pagar"). */
  action?: { label: string; url: string };
}

/** Paleta interna de cada tema: colores coherentes para fondo, marca y botón. */
interface ThemePalette {
  fontFamily: string;
  pageBg: string;
  cardBg: string;
  cardBorder: string;
  ink: string;
  inkSoft: string;
  /** Color de marca/acento (encabezado, enlaces, botón). */
  accent: string;
  accentInk: string;
  footerInk: string;
}

const PALETTES: Record<EmailThemeId, ThemePalette> = {
  calido: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    pageBg: '#faf6ef',
    cardBg: '#fffdf8',
    cardBorder: '#eadfca',
    ink: '#3d3528',
    inkSoft: '#7a6a52',
    accent: '#a06d3c',
    accentInk: '#ffffff',
    footerInk: '#a08a6b',
  },
  profesional: {
    fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
    pageBg: '#f3f4f8',
    cardBg: '#ffffff',
    cardBorder: '#e3e5f0',
    ink: '#1a1d27',
    inkSoft: '#5c607a',
    accent: '#5f6e3a',
    accentInk: '#ffffff',
    footerInk: '#8b8fa3',
  },
  minimal: {
    fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif",
    pageBg: '#ffffff',
    cardBg: '#ffffff',
    cardBorder: '#e8e9eb',
    ink: '#26282e',
    inkSoft: '#6b6e76',
    accent: '#33363d',
    accentInk: '#ffffff',
    footerInk: '#9b9ea5',
  },
};

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

/**
 * Texto plano → HTML: escapa, enlaza las URLs (con el color de acento del tema)
 * y convierte los saltos de línea. El texto se trata siempre como datos.
 */
function toHtmlBody(text: string, accent: string): string {
  return escapeHtml(text)
    .replace(URL_PATTERN, (url) => {
      // El escape ya convirtió comillas/símbolos; la URL solo trae caracteres seguros.
      return `<a href="${url}" style="color:${accent};text-decoration:underline;word-break:break-all;">${url}</a>`;
    })
    .replaceAll('\n', '<br/>');
}

/** Bloque de marca (logo + nombre de la organización) bajo el nombre del profesional. */
function orgBrand(data: EmailSenderData, color: string, align: 'center' | 'left'): string {
  if (!data.organizationName && !data.organizationLogoUrl) return '';
  const logo = data.organizationLogoUrl
    ? `<img src="${data.organizationLogoUrl}" alt="${escapeHtml(data.organizationName ?? 'Logo')}" width="auto" height="32" style="max-height:32px;display:inline-block;vertical-align:middle;margin-right:8px;border:0;"/>`
    : '';
  const name = data.organizationName
    ? `<span style="font-size:13px;color:${color};vertical-align:middle;">${escapeHtml(data.organizationName)}</span>`
    : '';
  return `<div style="margin-top:8px;text-align:${align};">${logo}${name}</div>`;
}

/** Botón de acción (CTA) maquetado con tabla, centrado y responsive. */
function actionButton(data: EmailSenderData, palette: ThemePalette): string {
  if (!data.action || !data.action.url) return '';
  const label = escapeHtml(data.action.label || 'Continuar');
  const url = data.action.url;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:22px auto 4px;">
    <tr><td style="border-radius:9px;background-color:${palette.accent};">
      <a href="${url}" style="display:inline-block;padding:12px 28px;font-family:${palette.fontFamily};font-size:15px;font-weight:600;color:${palette.accentInk};text-decoration:none;border-radius:9px;">${label}</a>
    </td></tr>
  </table>`;
}

function footer(palette: ThemePalette): string {
  return `<p style="margin:14px 0 0;font-size:11px;color:${palette.footerInk};text-align:center;letter-spacing:0.2px;">Enviado con EscuchaInterna</p>`;
}

function document(lang: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
</head>
<body style="margin:0;padding:0;width:100%;">
${bodyHtml}
</body>
</html>`;
}

/** Envoltura común: tabla externa centrada de ancho máx 600px sobre el fondo de página. */
function shell(palette: ThemePalette, innerHtml: string): string {
  return document(
    'es',
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${palette.pageBg};margin:0;padding:0;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;font-family:${palette.fontFamily};color:${palette.ink};">
      ${innerHtml}
    </table>
  </td></tr>
</table>`,
  );
}

function renderCalido(body: string, data: EmailSenderData): string {
  const palette = PALETTES.calido;
  const name = escapeHtml(data.professionalName);
  return shell(
    palette,
    `<tr><td style="padding:0 0 18px;text-align:center;">
      <p style="margin:0;font-size:21px;letter-spacing:0.5px;color:${palette.accent};">${name}</p>
      ${orgBrand(data, palette.inkSoft, 'center')}
    </td></tr>
    <tr><td style="background-color:${palette.cardBg};border:1px solid ${palette.cardBorder};border-radius:14px;padding:30px 28px;">
      <div style="font-size:15.5px;line-height:1.75;color:${palette.ink};">${toHtmlBody(body, palette.accent)}</div>
      ${actionButton(data, palette)}
    </td></tr>
    <tr><td style="padding-top:18px;">${footer(palette)}</td></tr>`,
  );
}

function renderProfesional(body: string, data: EmailSenderData): string {
  const palette = PALETTES.profesional;
  const name = escapeHtml(data.professionalName);
  return shell(
    palette,
    `<tr><td style="background-color:${palette.cardBg};border:1px solid ${palette.cardBorder};border-radius:12px;overflow:hidden;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="background-color:${palette.accent};padding:22px 28px;">
          <p style="margin:0;font-size:18px;font-weight:600;color:${palette.accentInk};">${name}</p>
          ${orgBrand(data, '#dcdcf7', 'left')}
        </td></tr>
        <tr><td style="padding:28px;">
          <div style="font-size:15px;line-height:1.7;color:${palette.ink};">${toHtmlBody(body, palette.accent)}</div>
          ${actionButton(data, palette)}
        </td></tr>
        <tr><td style="border-top:1px solid #ececf5;padding:14px 28px;background-color:#fafafe;">
          ${footer(palette)}
        </td></tr>
      </table>
    </td></tr>`,
  );
}

function renderMinimal(body: string, data: EmailSenderData): string {
  const palette = PALETTES.minimal;
  const name = escapeHtml(data.professionalName);
  return shell(
    palette,
    `<tr><td style="padding:0 4px;">
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:${palette.ink};">${name}</p>
      ${orgBrand(data, palette.inkSoft, 'left')}
      <hr style="border:none;border-top:1px solid ${palette.cardBorder};margin:16px 0 22px;"/>
      <div style="font-size:15px;line-height:1.75;color:${palette.ink};">${toHtmlBody(body, palette.accent)}</div>
      ${actionButton(data, palette)}
      <hr style="border:none;border-top:1px solid ${palette.cardBorder};margin:26px 0 0;"/>
      ${footer(palette)}
    </td></tr>`,
  );
}

/** Envuelve el contenido (texto plano) en el HTML completo del tema elegido. */
export function renderEmailTheme(theme: EmailThemeId, body: string, data: EmailSenderData): string {
  switch (theme) {
    case 'profesional':
      return renderProfesional(body, data);
    case 'minimal':
      return renderMinimal(body, data);
    case 'calido':
    default:
      return renderCalido(body, data);
  }
}

/** ¿El cuerpo ya es un correo HTML completo (ya envuelto en un tema)? */
export function isThemedEmailBody(body: string): boolean {
  return /^\s*<!doctype html/i.test(body) || /^\s*<html[\s>]/i.test(body);
}
