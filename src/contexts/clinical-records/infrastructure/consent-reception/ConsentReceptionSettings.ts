import { encryptField, decryptField } from '@/shared/infrastructure/crypto/FieldEncryption';
import { randomUUID } from 'node:crypto';
import { getDatabaseAdapter } from '@/shared/infrastructure/persistence/SqliteAdapter';
export interface ReceptionSettings { folder: string; formTemplate: string; }
export class ConsentReceptionSettings {
  public constructor(private readonly owner: string) {}
  private device(): string { return process.env.CONSENT_RECEPTION_DEVICE_ID ?? ''; }
  public async read(): Promise<ReceptionSettings | null> {
    if (!this.device()) return null;
    const row = await getDatabaseAdapter().queryRow<{ folder: string; form_template: string }>('SELECT folder, form_template FROM consent_reception_settings WHERE owner_user_id=? AND device_id=?', [this.owner, this.device()]);
    return row ? { folder: decryptField(row.folder), formTemplate: decryptField(row.form_template) } : null;
  }
  public async connect(folder: string): Promise<void> {
    await getDatabaseAdapter().execute(`INSERT INTO consent_reception_settings (id, owner_user_id, device_id, folder, form_template) VALUES (?, ?, ?, ?, '') ON CONFLICT(owner_user_id, device_id) DO UPDATE SET folder=excluded.folder`, [randomUUID(), this.owner, this.device(), encryptField(folder)]);
  }
  public async setFormTemplate(value: string): Promise<void> {
    if (value.length > 3000) throw new Error('El enlace del formulario es demasiado largo.');
    if (value) {
      const url = new URL(value);
      const codes = [...url.searchParams.entries()].filter(([key, content]) => /^entry\.\d+$/.test(key) && content === 'CODIGO');
      if (url.origin !== 'https://docs.google.com' || !/^\/forms\/d\/(?:e\/)?[\w-]+\/viewform$/.test(url.pathname) || codes.length !== 1 || url.username || url.password) throw new Error('Pega el enlace prellenado de Google Forms con CODIGO en el campo de recepción.');
    }
    await getDatabaseAdapter().execute('UPDATE consent_reception_settings SET form_template=? WHERE owner_user_id=? AND device_id=?', [encryptField(value), this.owner, this.device()]);
  }
  public async disconnect(): Promise<void> { await getDatabaseAdapter().execute('DELETE FROM consent_reception_settings WHERE owner_user_id=? AND device_id=?', [this.owner, this.device()]); }
}
