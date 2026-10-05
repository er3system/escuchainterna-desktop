'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Button, Input } from '@/components/ui';
import type { PersonalProviderName } from '@/contexts/practitioner/domain/personalProviders';
import { personalProviderAction, type PersonalProviderState } from './personalProviderActions';
export function PersonalProviderForm({ provider, configured, model, sender }: { provider: PersonalProviderName; configured: boolean; model: string; sender: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(personalProviderAction, {} as PersonalProviderState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok) form.current?.reset(); }, [state]);
  return <div className="mt-4 border-t border-line pt-4">
    <div className="flex gap-2"><Button type="button" variant="soft" onClick={() => setOpen(!open)}>{configured ? 'Reemplazar mi clave' : 'Conectar con mi propia clave'}</Button>
      {configured ? <form action={action}><input type="hidden" name="provider" value={provider} /><input type="hidden" name="intent" value="disconnect" /><Button variant="ghost" disabled={pending}>Desconectar</Button></form> : null}</div>
    {open ? <form ref={form} action={action} className="mt-4 space-y-3">
      <input type="hidden" name="provider" value={provider} />
      <label className="block text-sm font-medium" htmlFor={`${provider}-key`}>Clave API propia</label><Input id={`${provider}-key`} name="api_key" type="password" required autoComplete="off" minLength={16} maxLength={4096} placeholder={provider === 'resend' ? 're_…' : provider === 'anthropic' ? 'sk-ant-…' : 'sk-…'} />
      {provider === 'resend' ? <><label className="block text-sm font-medium" htmlFor={`${provider}-sender`}>Remitente de tu dominio verificado</label><Input id={`${provider}-sender`} type="email" name="sender" required defaultValue={sender} placeholder="consulta@tudominio.com" /></> : <><label className="block text-sm font-medium" htmlFor={`${provider}-model`}>ID de modelo disponible en tu cuenta</label><Input id={`${provider}-model`} name="model" required defaultValue={model} placeholder={provider === 'openai' ? 'ID del modelo de OpenAI' : 'ID del modelo de Claude'} /><p className="text-xs text-ink-soft">Al conectar un proveedor de IA se desactiva el otro. OpenAI se usa en el chat; Anthropic también en las herramientas clínicas.</p></>}
      <label className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft"><input type="checkbox" name="authorized" required className="mt-1" /><span>Autorizo enviar al proveedor {provider === 'resend' ? 'el destinatario y contenido de los correos que genere' : 'las preguntas y el contexto de mis pacientes necesario para responder'}. El servicio requiere internet y factura el uso a mi cuenta.</span></label>
      <p className="text-xs text-ink-soft">La clave se guarda cifrada por cuenta; no vuelve a mostrarse. También viaja cifrada en tus respaldos y sincronización de Drive.</p>
      <Button disabled={pending}>{pending ? 'Guardando…' : 'Guardar y habilitar'}</Button>
    </form> : null}
    {state.error || state.ok ? <p role="status" className={`mt-3 text-sm ${state.error ? 'text-danger' : 'text-success'}`}>{state.error ?? state.ok}</p> : null}
  </div>;
}
