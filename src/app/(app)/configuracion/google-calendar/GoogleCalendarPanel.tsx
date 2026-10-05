'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Input } from '@/components/ui';
import type { CalendarConnectionSummary } from '@/contexts/practitioner/application/google-calendar/GoogleCalendarConsultation';
import { googleCalendarAction, type GoogleCalendarActionState } from './actions';
function dateInput(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function GoogleCalendarPanel({ summary }: { summary: CalendarConnectionSummary }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(googleCalendarAction, {} as GoogleCalendarActionState);
  const [clientId, setClientId] = useState(''); const [clientSecret, setClientSecret] = useState(''); const [importError, setImportError] = useState(''); const [reconnect, setReconnect] = useState(false);
  const [dates, setDates] = useState({ from: '', to: '' }); const form = useRef<HTMLFormElement>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => { const today = new Date(); const end = new Date(today); end.setDate(end.getDate() + 30); setDates({ from: dateInput(today), to: dateInput(end) }); }, []);
  useEffect(() => {
    if (!state.url) return;
    setClientId(''); setClientSecret(''); form.current?.reset();
    const timer = setInterval(() => router.refresh(), 5000); poll.current = timer; const stop = setTimeout(() => clearInterval(timer), 300_000);
    return () => { clearInterval(timer); clearTimeout(stop); };
  }, [state.url, router]);
  useEffect(() => { if (summary.connected) { setReconnect(false); if (poll.current) clearInterval(poll.current); } }, [summary.connected, summary.account, summary.authorizedAt]);
  async function importClient(file?: File): Promise<void> {
    setImportError(''); if (!file) return;
    try {
      if (file.size > 16_384) throw new Error();
      const json = JSON.parse(await file.text()); const installed = json?.installed;
      if (!installed || typeof installed.client_id !== 'string' || (installed.client_secret !== undefined && typeof installed.client_secret !== 'string')) throw new Error();
      setClientId(installed.client_id); setClientSecret(installed.client_secret ?? '');
    } catch { setImportError('Elige el JSON de un cliente OAuth de tipo «Aplicación de escritorio» descargado desde Google Cloud.'); }
  }
  const startDate = dates.from ? new Date(`${dates.from}T00:00:00`) : null;
  const start = startDate && !Number.isNaN(startDate.getTime()) ? startDate.toISOString() : '';
  const endDate = dates.to ? new Date(`${dates.to}T00:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate && !Number.isNaN(endDate.getTime()) ? endDate.toISOString() : '';
  return <section className="rounded-card border border-line bg-surface p-5 shadow-card">
    <Badge tone={summary.connected ? 'success' : 'neutral'}>{summary.connected ? 'Cuenta autorizada' : 'Sin conectar'}</Badge>
    <h2 className="mt-3 font-display text-xl font-bold">{summary.connected ? summary.account : 'Conecta tu cuenta de Google'}</h2>
    <p className="mt-3 text-sm text-ink-soft">Se crea un calendario separado llamado «EscuchaInterna». Los eventos solo muestran «Sesión de consulta» y su horario; no incluyen pacientes, correos, notas ni invitados. Para revisar coincidencias se consulta únicamente cuándo está ocupado tu calendario principal.</p>
    <p className="mt-3 text-xs text-ink-soft">La conexión requiere internet. Calendar no importa pacientes ni cambios de Google a la agenda local y no publica cambios automáticamente. Drive sincroniza la consulta entre PCs por separado.</p>
    {summary.connected ? <>
      <p className="mt-4 text-sm">Última publicación: {summary.lastPublishedAt ? new Date(summary.lastPublishedAt).toLocaleString('es') : 'Todavía no has publicado horarios'}</p>
      <form action={action} className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-3"><label className="text-sm">Desde<Input type="date" value={dates.from} required onChange={event => setDates({ ...dates, from: event.target.value })} /></label><label className="text-sm">Hasta<Input type="date" value={dates.to} required onChange={event => setDates({ ...dates, to: event.target.value })} /></label></div>
        <input type="hidden" name="start" value={start} /><input type="hidden" name="end" value={end} />
        <label className="flex items-start gap-2 text-sm text-ink-soft"><input type="checkbox" name="authorized" required className="mt-1" /><span>Autorizo consultar disponibilidad o publicar estos horarios en Google. Publicar actualiza y retira los horarios de la app en este intervalo para reflejar mi agenda actual.</span></label>
        <div className="flex flex-wrap gap-3"><Button name="intent" value="availability" variant="soft" disabled={pending}>Revisar coincidencias</Button><Button name="intent" value="publish" disabled={pending}>{pending ? 'Procesando…' : 'Publicar horarios'}</Button></div>
      </form>
      <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4"><Button variant="ghost" type="button" onClick={() => setReconnect(!reconnect)} disabled={pending}>Volver a autorizar</Button><form action={action}><Button name="intent" value="disconnect" variant="ghost" disabled={pending}>Desconectar de esta consulta</Button></form><a href="https://calendar.google.com" target="_blank" rel="noreferrer" className="self-center text-sm text-accent-strong underline">Abrir Google Calendar ↗</a></div>
      <p className="mt-2 text-xs text-ink-soft">Desconectar elimina los tokens locales; conserva el calendario y sus eventos. Para revocar el permiso de Google, revisa <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer" className="text-accent-strong underline">las conexiones de tu cuenta ↗</a>.</p>
    </> : null}
    {!summary.connected || reconnect ? <form ref={form} action={action} className="mt-5 space-y-3 border-t border-line pt-5">
      <input type="hidden" name="intent" value="connect" />
      <label htmlFor="calendar-json" className="block text-sm font-semibold">Importar cliente de Google Cloud (JSON)</label><input id="calendar-json" type="file" accept=".json,application/json" onChange={event => void importClient(event.target.files?.[0])} className="block w-full text-sm" />
      {importError ? <p role="alert" className="text-sm text-danger">{importError}</p> : null}
      <label htmlFor="calendar-client" className="block text-sm font-medium">ID de cliente OAuth de escritorio</label><Input id="calendar-client" name="client_id" value={clientId} onChange={event => setClientId(event.target.value)} required maxLength={280} autoComplete="off" placeholder="…apps.googleusercontent.com" />
      <label htmlFor="calendar-secret" className="block text-sm font-medium">Secreto del cliente, si figura en el JSON</label><Input id="calendar-secret" name="client_secret" type="password" value={clientSecret} onChange={event => setClientSecret(event.target.value)} maxLength={512} autoComplete="off" />
      <label className="flex items-start gap-2 text-sm text-ink-soft"><input type="checkbox" name="authorized" required className="mt-1" /><span>Autorizo conectar mi cuenta, crear el calendario de EscuchaInterna y consultar disponibilidad. Las credenciales se guardan cifradas en esta consulta y también se incluyen cifradas en sus respaldos de Drive.</span></label>
      <Button disabled={pending}>{pending ? 'Preparando…' : 'Preparar conexión'}</Button>
    </form> : null}
    {state.url && (!summary.connected || reconnect) ? <div className="mt-4 rounded-lg border border-primary/30 bg-primary-light p-4"><a href={state.url} target="_blank" rel="noreferrer" className="font-semibold text-accent-strong underline">Continuar en Google ↗</a><p className="mt-2 text-sm text-ink-soft">Elige tu cuenta en el navegador, autoriza y regresa aquí. Esta solicitud vence en cinco minutos. Si Google la rechaza, comprueba el tipo de cliente, los usuarios de prueba y Calendar API.</p></div> : null}
    {state.error || state.ok ? <p role="status" className={`mt-4 text-sm ${state.error ? 'text-danger' : 'text-success'}`}>{state.error ?? state.ok}</p> : null}
    {state.conflicts?.length ? <ul className="mt-3 space-y-1 text-sm text-ink-soft">{state.conflicts.map((time, index) => <li key={`${time.start}-${index}`}>{new Date(time.start).toLocaleString('es')} – {new Date(time.end).toLocaleTimeString('es')}</li>)}</ul> : null}
  </section>;
}
