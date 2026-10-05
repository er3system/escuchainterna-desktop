import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ReceivedConsentMime } from '../../domain/value-objects/ReceivedConsentDocument';
import { ReceiveConsentDocument } from '../../application/receive-consent-document/ReceiveConsentDocument';
import { ReceiveConsentDocumentMessage } from '../../application/receive-consent-document/ReceiveConsentDocumentMessage';
import { SqliteConsentInboxRepository } from '../persistence/SqliteConsentInboxRepository';
import { LocalConsentReceiptStorage } from '../files/LocalConsentReceiptStorage';
import { ConsentReceptionSettings } from './ConsentReceptionSettings';
const MAX_BYTES = 20 * 1024 * 1024;
interface ObservedFile { fingerprint: string; firstSeenAt: number; hash?: string; }
interface FolderCursor { root: string; entries: AsyncGenerator<string | null>; }
const runtime = globalThis as typeof globalThis & { consentReceptionObserved?: Map<string, ObservedFile>; consentReceptionLocks?: Map<string, Promise<ScanResult>>; consentReceptionCursors?: Map<string, FolderCursor> };
const observed = runtime.consentReceptionObserved ??= new Map();
const locks = runtime.consentReceptionLocks ??= new Map();
const cursors = runtime.consentReceptionCursors ??= new Map();
export interface ScanResult { imported: number; pending: number; unavailable: boolean; skipped: number; }
/** Cabecera y terminación: se rechazan SVG, ejecutables y PDF todavía incompletos. */
export function receivedDocumentMime(data: Buffer, extension: string): ReceivedConsentMime | null {
  if (extension === '.pdf' && data.subarray(0, 5).toString() === '%PDF-' && data.subarray(Math.max(0, data.length - 4096)).includes(Buffer.from('%%EOF'))) return 'application/pdf';
  if (extension === '.png' && data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && data.subarray(-12).subarray(4, 8).toString() === 'IEND') return 'image/png';
  if (['.jpg', '.jpeg'].includes(extension) && data[0] === 255 && data[1] === 216 && data.at(-2) === 255 && data.at(-1) === 217) return 'image/jpeg';
  if (extension === '.webp' && data.length >= 12 && data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP' && data.readUInt32LE(4) + 8 === data.length) return 'image/webp';
  return null;
}
export async function assertConsentReceptionFolder(folder: string): Promise<string> {
  if (!path.isAbsolute(folder) || (await fs.lstat(folder)).isSymbolicLink()) throw new Error('Selecciona una carpeta real, sin enlaces a otra ubicación.');
  const real = await fs.realpath(folder);
  if (!(await fs.stat(real)).isDirectory()) throw new Error('La ubicación no es una carpeta.');
  const directory = await fs.opendir(real);
  for await (const item of directory) if (/\.(eichannel|eisync|eibackup)$/i.test(item.name)) throw new Error('Usa una carpeta distinta de la sincronización cifrada de la consulta.');
  return real;
}
async function* candidates(folder: string, depth = 0): AsyncGenerator<string | null> {
  const directory = await fs.opendir(folder);
  for await (const item of directory) {
    // Cada entrada cuenta en el presupuesto, incluidas las que no son documentos.
    yield null;
    if (item.isSymbolicLink() || item.name.startsWith('.')) continue;
    const absolute = path.join(folder, item.name);
    if (item.isDirectory() && depth < 2) yield* candidates(absolute, depth + 1);
    else if (item.isFile() && /\.(pdf|png|jpe?g|webp)$/i.test(item.name)) yield absolute;
  }
}
export class FolderConsentReceiver {
  public constructor(private readonly owner: string) {}
  public async receive(): Promise<ScanResult> {
    const running = locks.get(this.owner); if (running) return running;
    const operation = this.scan(); locks.set(this.owner, operation);
    try { return await operation; } finally { locks.delete(this.owner); }
  }
  private async scan(): Promise<ScanResult> {
    const repository = new SqliteConsentInboxRepository(this.owner);
    const receiver = new ReceiveConsentDocument(repository, new LocalConsentReceiptStorage(this.owner));
    const settings = await new ConsentReceptionSettings(this.owner).read();
    const result: ScanResult = { imported: 0, pending: 0, unavailable: false, skipped: 0 };
    if (settings) {
      try {
        const root = await assertConsentReceptionFolder(settings.folder);
        let cursor = cursors.get(this.owner);
        if (cursor && cursor.root !== root) { await cursor.entries.return(undefined); cursors.delete(this.owner); cursor = undefined; }
        if (!cursor) { cursor = { root, entries: candidates(root) }; cursors.set(this.owner, cursor); }
        let reads = 0; let entries = 0;
        // El cursor continúa en la siguiente revisión: los archivos antiguos nunca
        // impiden recibir otros aunque la carpeta supere mil entradas.
        while (reads < 20 && entries < 1000) {
          const next = await cursor.entries.next();
          if (next.done) { cursors.delete(this.owner); break; }
          if (next.value === null) { entries++; continue; }
          const file = next.value;
          const key = `${this.owner}:${file}`;
          try {
            const stat = await fs.lstat(file);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 8 || stat.size > MAX_BYTES) { result.skipped++; continue; }
            const real = await fs.realpath(file);
            if (!real.startsWith(root + path.sep)) { result.skipped++; continue; }
            const fingerprint = `${stat.size}:${stat.mtimeMs}`;
            const previous = observed.get(key);
            if (!previous || previous.fingerprint !== fingerprint) { observed.set(key, { fingerprint, firstSeenAt: Date.now() }); continue; }
            if (Date.now() - previous.firstSeenAt < 1000) continue;
            if (previous.hash && await repository.hasContent(previous.hash)) continue;
            reads++;
            const data = await fs.readFile(real);
            const after = await fs.lstat(file);
            if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || data.length !== stat.size || after.isSymbolicLink()) continue;
            const mime = receivedDocumentMime(data, path.extname(file).toLowerCase());
            if (!mime) { result.skipped++; continue; }
            const hash = createHash('sha256').update(data).digest('hex');
            previous.hash = hash;
            if (await repository.hasContent(hash)) continue;
            const code = path.basename(file).match(/^([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})__/i)?.[1];
            if (await receiver.receive(new ReceiveConsentDocumentMessage(path.basename(file).slice(0, 240), mime, hash, data, code?.toLowerCase() ?? null))) result.imported++;
          } catch { result.skipped++; }
        }
        // La memoria contiene solo las observaciones de la carpeta vigente, con un límite fijo.
        if (observed.size > 2000) observed.clear();
      } catch { result.unavailable = true; const cursor = cursors.get(this.owner); cursors.delete(this.owner); try { await cursor?.entries.return(undefined); } catch { /* La carpeta pudo desaparecer. */ } }
    } else {
      const cursor = cursors.get(this.owner); cursors.delete(this.owner); await cursor?.entries.return(undefined);
    }
    result.pending = await repository.pendingCount();
    return result;
  }
}
