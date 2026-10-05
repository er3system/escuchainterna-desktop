import fs from 'node:fs';
import path from 'node:path';
import type { FileStorage } from './FileStorage';

function uploadsRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_PATH ?? './data/uploads');
}

/**
 * Tolera keys LEGADAS que incluían el prefijo local `data/uploads/` (las fotos/
 * logos previos a 0e guardaban la ruta completa en BD). Las nuevas son limpias
 * (`perfil/...`, `orgs/<id>/...`) → portables a object storage.
 */
function normalizeKey(key: string): string {
  return key.replace(/^[/\\]+/, '').replace(/^data[/\\]uploads[/\\]/, '');
}

/** Almacenamiento local genérico (no clínico) bajo data/uploads/. */
export class LocalFileStorage implements FileStorage {
  public async save(key: string, data: Uint8Array): Promise<void> {
    const absolute = this.resolve(key);
    if (!absolute) throw new Error('Key de archivo inválida.');
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, data);
  }

  public async read(key: string): Promise<Uint8Array | null> {
    const absolute = this.resolve(key);
    if (!absolute || !fs.existsSync(absolute)) return null;
    return fs.readFileSync(absolute);
  }

  public async delete(key: string): Promise<void> {
    const absolute = this.resolve(key);
    if (absolute && fs.existsSync(absolute)) fs.unlinkSync(absolute);
  }

  /** Ruta absoluta dentro de uploads, o null si la key escapa (path traversal). */
  private resolve(key: string): string | null {
    const root = uploadsRoot();
    const absolute = path.resolve(root, normalizeKey(key));
    if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
    return absolute;
  }
}
