import fs from 'node:fs';
import path from 'node:path';
import { decryptBytes, encryptBytes } from '@/shared/infrastructure/crypto/FieldEncryption';
import type { PatientFileStorage } from '../../domain/PatientFileStorage';

function uploadsRoot(): string {
  return path.resolve(process.cwd(), process.env.UPLOADS_PATH ?? './data/uploads');
}

/**
 * Almacenamiento local de archivos del paciente en data/uploads/<patientId>/.
 * Cumple el puerto async (las operaciones de disco son síncronas dentro, pero la
 * firma es async para intercambiarse con el de object storage). El cifrado
 * at-rest portará sin cambio al impl de Supabase (cifra antes de subir).
 */
export class LocalPatientFileStorage implements PatientFileStorage {
  public async save(patientId: string, sanitizedName: string, data: Uint8Array): Promise<string> {
    const directory = path.join(uploadsRoot(), patientId);
    fs.mkdirSync(directory, { recursive: true });

    let finalName = sanitizedName;
    let counter = 1;
    while (fs.existsSync(path.join(directory, finalName))) {
      const extension = path.extname(sanitizedName);
      const base = path.basename(sanitizedName, extension);
      finalName = `${base} (${counter})${extension}`;
      counter += 1;
    }
    // Cifrado at-rest: los adjuntos clínicos (fotos del consentimiento, escaneos, PDF) se
    // guardan cifrados, coherente con el resto del dato clínico. Se descifran al servir.
    fs.writeFileSync(path.join(directory, finalName), encryptBytes(data));
    return path.posix.join(patientId, finalName);
  }

  public async read(storedPath: string): Promise<Uint8Array | null> {
    const absolute = this.absolutePathOf(storedPath);
    if (!absolute || !fs.existsSync(absolute)) return null;
    // decryptBytes es retrocompatible: un archivo previo al cifrado se devuelve tal cual.
    return decryptBytes(fs.readFileSync(absolute));
  }

  public async delete(storedPath: string): Promise<void> {
    const absolute = this.absolutePathOf(storedPath);
    if (absolute && fs.existsSync(absolute)) fs.unlinkSync(absolute);
  }

  /** Ruta absoluta del archivo, o null si escapa del directorio de uploads (path traversal). */
  private absolutePathOf(storedPath: string): string | null {
    const absolute = path.resolve(uploadsRoot(), storedPath);
    if (!absolute.startsWith(uploadsRoot() + path.sep)) return null;
    return absolute;
  }
}
