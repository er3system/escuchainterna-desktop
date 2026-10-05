/**
 * Decodifica los bytes de un CSV a texto tolerando los dos encodings que
 * producen Excel y los sistemas universitarios: UTF-8 (con o sin BOM) y
 * latin1/windows-1252. Módulo puro: corre igual en navegador y en Node.
 */
export function decodeCsvBytes(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let text: string;
  try {
    // fatal:true ⇒ si hay bytes que no son UTF-8 válido (típico de latin1),
    // lanza y caemos al plan B en lugar de sembrar "�" en los nombres.
    text = new TextDecoder('utf-8', { fatal: true }).decode(view);
  } catch {
    text = decodeLatin1(view);
  }
  return stripBom(text);
}

/** Quita el BOM inicial (U+FEFF) que Excel antepone a sus CSV UTF-8. */
export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function decodeLatin1(view: Uint8Array): string {
  try {
    return new TextDecoder('windows-1252').decode(view);
  } catch {
    // Node compilado sin ICU completo: mapeo manual byte → U+00XX (latin1).
    let result = '';
    for (const byte of view) result += String.fromCharCode(byte);
    return result;
  }
}
