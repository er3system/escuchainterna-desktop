'use client';

import { useEffect, useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import { Button } from '@/components/ui';

export function DocumentPrintActions({ fileName, printLabel = 'Imprimir', pdfLabel = 'Guardar PDF' }: {
  fileName: string;
  printLabel?: string;
  pdfLabel?: string;
}) {
  const [native, setNative] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setNative(typeof window.escuchaDesktop?.savePdf === 'function'); }, []);

  async function savePdf() {
    const save = window.escuchaDesktop?.savePdf;
    if (!save || saving) return;
    setSaving(true); setMessage(''); setError('');
    try {
      const result = await save(fileName.slice(0, 240));
      if (!result.canceled) setMessage('PDF guardado.');
    } catch {
      setError('No se pudo guardar el PDF. Comprueba la carpeta elegida e inténtalo de nuevo.');
    } finally { setSaving(false); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      {native ? <Button type="button" onClick={savePdf} disabled={saving}>
        <FileDown size={15} /> {saving ? 'Guardando PDF…' : pdfLabel}
      </Button> : null}
      <Button type="button" variant="outline" onClick={() => window.print()} disabled={saving}>
        <Printer size={15} /> {printLabel}
      </Button>
      <span role="status" className="text-xs text-success">{message}</span>
      {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
    </div>
  );
}
