'use client';

/**
 * Convierte una imagen a WebP en el NAVEGADOR (canvas) antes de subirla:
 * formatos económicos sin dependencias nativas en el servidor.
 * - Reescala a máx. 1600px en el lado largo (suficiente para fotos/logos/escaneos).
 * - Calidad 0.85.
 * - Si el archivo no es imagen o el navegador no soporta WebP, devuelve el original.
 */
export async function imageToWebp(file: File, maxSide = 1600, quality = 0.85): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/webp' || file.type === 'image/svg+xml') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/webp', quality),
    );
    if (!blob || blob.type !== 'image/webp') return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
  } catch {
    return file;
  }
}
