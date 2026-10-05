'use client';

import { useEffect, useState } from 'react';
import { Cloud, Download, Upload, FolderSync, RefreshCw, ShieldCheck, AlertTriangle, Unplug } from 'lucide-react';
import { Button, Card } from '@/components/ui';

interface SynchronizationStatus {
  connected: boolean;
  folder?: string;
  conflict: boolean;
  pending: boolean;
  base?: string | null;
  revisions: { id: string; createdAt: string; thisDevice: boolean }[];
}
interface DesktopSynchronizationBridge {
  chooseConsentFolder?: (owner: string) => Promise<string | null>;
  driveStatus?: () => Promise<{ folders: string[] }>;
  synchronizationStatus: () => Promise<SynchronizationStatus>;
  connectSynchronization: () => Promise<SynchronizationStatus>;
  publishSynchronization: () => Promise<SynchronizationStatus>;
  receiveSynchronization: (id: string) => Promise<SynchronizationStatus>;
  disconnectSynchronization: () => Promise<SynchronizationStatus>;
}
declare global { interface Window { escuchaDesktop?: DesktopSynchronizationBridge } }

export function SynchronizationPanel() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<SynchronizationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [driveFolders, setDriveFolders] = useState<string[] | null>(null);

  function apply(next: SynchronizationStatus) {
    setStatus(next);
    setSelected(previous => next.revisions.some(revision => revision.id === previous) ? previous : next.revisions[0]?.id ?? '');
  }

  useEffect(() => {
    let mounted = true;
    const bridge = window.escuchaDesktop;
    setAvailable(Boolean(bridge));
    if (bridge) bridge.synchronizationStatus().then(next => { if (mounted) apply(next); }).catch(() => { if (mounted) setError('No se pudo leer la carpeta. Comprueba que esté disponible sin conexión y vuelve a conectar si es necesario.'); });
    if (bridge?.driveStatus) bridge.driveStatus().then(next => { if (mounted) setDriveFolders(next.folders); }).catch(() => { if (mounted) setDriveFolders([]); });
    return () => { mounted = false; };
  }, []);

  async function run(action: (bridge: DesktopSynchronizationBridge) => Promise<SynchronizationStatus>) {
    if (!window.escuchaDesktop || busy) return;
    setBusy(true); setError('');
    try { apply(await action(window.escuchaDesktop)); if (window.escuchaDesktop.driveStatus) setDriveFolders((await window.escuchaDesktop.driveStatus()).folders); }
    catch (caught) { setError(caught instanceof Error ? caught.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : 'No se pudo completar la operación. Tus datos se conservan.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start gap-4"><span className="ei-icon-tile"><Cloud size={22} /></span><div><h2 className="font-display text-xl font-bold">Tu consulta, entre tus PCs</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">Google Drive transporta las versiones cifradas. EscuchaInterna trabaja con una copia local y tú decides cuándo publicar o recibir el espacio completo.</p></div></div>
        <ol className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
          {['Crea una carpeta en Mi unidad y déjala disponible sin conexión en ambas PCs.', 'Conecta esa carpeta con la misma contraseña en las dos instalaciones.', 'Publica al terminar. Espera a Drive y recibe la versión antes de trabajar en la otra PC.'].map((text, index) => <li key={text} className="rounded-xl border border-line bg-bg/60 p-4"><span className="mb-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">{index + 1}</span><p className="text-xs leading-relaxed text-ink-soft">{text}</p></li>)}
        </ol>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><FolderSync size={18} /> Carpeta de sincronización</h2>{status?.connected ? <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">Configurada en esta PC</span> : null}</div>
        {available && !status?.connected ? <div className="mb-4 rounded-xl border border-line bg-bg p-4 text-sm"><h3 className="font-semibold">1 · Prepara Drive en Windows</h3><p className="mt-2 text-ink-soft">{driveFolders?.length ? 'Encontramos Mi unidad. Al conectar abriremos esa ubicación si hay una sola disponible.' : 'Instala Drive para escritorio e inicia sesión con tu cuenta de Google. Después pulsa Actualizar estado.'}</p><a href="https://www.google.com/drive/download/" target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-medium text-accent-strong underline">Descargar Drive para escritorio ↗</a><h3 className="mt-4 font-semibold">2 · Conecta una carpeta y protégela</h3><p className="mt-2 text-ink-soft">Pulsa Conectar, crea una carpeta llamada EscuchaInterna dentro de Mi unidad y selecciónala. En Drive márcala disponible sin conexión. El programa te pedirá una contraseña de cifrado; usa la misma en la otra PC.</p><h3 className="mt-4 font-semibold">3 · Publica tu primera versión</h3><p className="mt-2 text-ink-soft">Conectar prepara la carpeta. Publicar cambios copia tu consulta cifrada. Espera a que Drive confirme la subida.</p></div> : null}
        {available === false ? <p className="rounded-xl bg-warning-soft p-4 text-sm text-ink">Abre esta pantalla desde el programa de Windows instalado. La conexión a carpetas está disponible en la ventana de EscuchaInterna.</p> : null}
        {available === null ? <p className="text-sm text-ink-soft">Comprobando el programa…</p> : null}
        {status?.folder ? <p className="mb-4 break-all rounded-xl border border-line bg-bg p-3 font-mono text-xs text-ink-soft">{status.folder}</p> : <p className="mb-4 text-sm text-ink-soft">Elige una carpeta vacía para empezar o la misma carpeta que ya usa tu otra PC.</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!available || busy} onClick={() => run(bridge => bridge.connectSynchronization())}><FolderSync size={16} /> {status?.connected ? 'Cambiar o reconectar carpeta' : 'Conectar carpeta de Drive'}</Button>
          <Button type="button" variant="outline" disabled={!available || busy} onClick={() => run(bridge => bridge.synchronizationStatus())}><RefreshCw size={16} className={busy ? 'animate-spin' : ''} /> Actualizar estado</Button>
          {status?.connected ? <Button type="button" variant="ghost" disabled={busy} onClick={() => run(bridge => bridge.disconnectSynchronization())}><Unplug size={15} /> Desconectar</Button> : null}
        </div>
        {error ? <p role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-ink">{error}</p> : null}
      </Card>

      {status?.connected ? <Card>
        <h2 className="mb-4 font-semibold">Continuar en otro equipo</h2>
        {status.conflict ? <div role="alert" className="mb-4 flex gap-3 rounded-xl bg-warning-soft p-4 text-sm text-ink"><AlertTriangle size={20} className="shrink-0 text-warning" /><p>Hay versiones distintas. Elige la que quieres continuar y recíbela. Todas las versiones de Drive y una copia completa de la consulta actual se conservarán; los expedientes no se combinan automáticamente.</p></div> : status.pending ? <p className="mb-4 text-sm text-ink-soft">Hay una versión por recibir. Revísala antes de publicar desde este equipo.</p> : <p className="mb-4 text-sm text-ink-soft">Puedes publicar los cambios guardados en esta PC.</p>}
        {status.revisions.length ? <fieldset className="mb-5"><legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">Versiones disponibles</legend><div className="space-y-2">{status.revisions.map((revision, index) => <label key={revision.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3"><input type="radio" name="sync-version" value={revision.id} checked={selected === revision.id} onChange={() => setSelected(revision.id)} disabled={busy} /><span className="text-sm"><strong>Versión {index + 1}</strong> · {new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(revision.createdAt))}<span className="mt-1 block text-xs text-ink-soft">{revision.thisDevice ? 'Publicada desde esta PC' : 'Publicada desde otra PC'}{revision.id === status.base ? ' · Ya recibida' : ''}</span></span></label>)}</div></fieldset> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={busy || status.conflict || status.pending} onClick={() => run(bridge => bridge.publishSynchronization())}><Upload size={16} /> Publicar cambios</Button>
          <Button type="button" variant="outline" disabled={busy || !selected || (!status.pending && !status.conflict)} onClick={() => run(bridge => bridge.receiveSynchronization(selected))}><Download size={16} /> Recibir versión seleccionada</Button>
        </div>
      </Card> : null}

      <div className="flex gap-3 rounded-xl border border-line p-4 text-xs leading-relaxed text-ink-soft"><ShieldCheck size={19} className="shrink-0 text-accent-strong" /><p>Se sincronizan todas las cuentas, expedientes, adjuntos y claves de esta instalación dentro de archivos cifrados. El límite actual es 256 MiB por consulta. Conserva la contraseña: no podemos recuperarla. Drive realiza la entrega; comprueba que termine antes de cambiar de PC. La base de datos activa permanece fuera de Drive.</p></div>
    </div>
  );
}
