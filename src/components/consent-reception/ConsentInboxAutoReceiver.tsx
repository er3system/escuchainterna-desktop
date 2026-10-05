'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileCheck2 } from 'lucide-react';
import type { ScanResult } from '@/contexts/clinical-records/infrastructure/consent-reception/FolderConsentReceiver';
import { useToast } from '@/components/Toast';
/** Se mantiene montado en el layout: sigue recibiendo al navegar por la consulta. */
export function ConsentInboxAutoReceiver() {
  const [pending, setPending] = useState(0); const toast = useToast();
  useEffect(() => {
    let stopped = false, running = false; const controller = new AbortController();
    const scan = async () => { if (stopped || running) return; running = true; try { const response = await fetch('/api/consentimientos/recepcion', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'x-escucha-consent-reception': '1' }, signal: controller.signal }); if (!response.ok) return; const result: ScanResult = await response.json(); if (stopped) return; setPending(result.pending); if (result.imported) { toast.info(`${result.imported === 1 ? 'Llegó un consentimiento' : `Llegaron ${result.imported} consentimientos`}. Revisa la bandeja.`); window.dispatchEvent(new Event('consent-inbox-updated')); } } catch { /* Se reintenta tras reinicio, desconexión o cierre de sesión. */ } finally { running = false; } };
    void scan(); const interval = setInterval(() => void scan(), 30000); window.addEventListener('consent-inbox-rescan', scan);
    return () => { stopped = true; controller.abort(); clearInterval(interval); window.removeEventListener('consent-inbox-rescan', scan); };
  }, [toast]);
  return pending ? <Link href="/consentimientos" className="mb-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-light px-4 py-3 text-sm text-primary"><FileCheck2 size={18} />{pending} {pending === 1 ? 'consentimiento recibido pendiente' : 'consentimientos recibidos pendientes'} de revisión<span className="ml-auto font-semibold">Abrir bandeja →</span></Link> : null;
}
