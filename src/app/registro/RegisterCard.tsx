'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { UserCheck } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { PhoneInput } from '@/components/PhoneInput';
import { Button, Input } from '@/components/ui';
import { registerAction, type RegisterFormState } from './actions';

const INITIAL: RegisterFormState = {};

export function RegisterCard({ referralCode = '', desktopEdition = false }: { referralCode?: string; desktopEdition?: boolean }) {
  const [state, dispatch, pending] = useActionState(registerAction, INITIAL);
  const [phone, setPhone] = useState({ dialCode: '+57', number: '' });
  const [synchronization, setSynchronization] = useState('local');

  return (
    <div className="w-full max-w-md rounded-card border border-line bg-surface p-8 shadow-card">
      <div className="mb-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <LogoMark size={30} />
          <p className="text-2xl font-bold tracking-tight text-ink">
            escucha<span className="text-primary dark:text-accent-2">interna</span>
          </p>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-ink">{desktopEdition ? 'Crea tu cuenta local' : 'Crea tu cuenta'}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {desktopEdition ? 'EscuchaInterna para PC. Tu cuenta y tus datos se guardan en este equipo, sin suscripción.' : 'Prueba gratis de 7 días, sin tarjeta. Tu consulta, organizada en un solo lugar.'}
        </p>
        {referralCode ? (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success">
            <UserCheck size={13} /> Invitado por un colega ✓
          </p>
        ) : null}
      </div>

      <form action={dispatch} className="space-y-3">
        {desktopEdition ? <fieldset className="mb-5 rounded-xl border border-line bg-bg p-4"><legend className="px-1 text-xs font-semibold">Dónde quieres continuar tu consulta</legend>
          <label className="flex items-center gap-2 text-sm"><input type="radio" name="synchronization" value="local" checked={synchronization === 'local'} onChange={() => setSynchronization('local')} /> Solo en esta PC</label>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="radio" name="synchronization" value="drive" checked={synchronization === 'drive'} onChange={() => setSynchronization('drive')} /> Preparar Google Drive</label>
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">Tu cuenta sigue siendo local. Drive guarda versiones cifradas para continuar en otra PC; lo conectaremos después de crear la cuenta.</p>
          <Link href="/sincronizacion?recuperar=1" className="mt-3 block text-xs font-medium text-accent-strong underline">Ya tengo mi consulta en Drive: traerla antes de registrarme</Link>
        </fieldset> : null}
        {/* Código de referido oculto (v3 §11) */}
        {referralCode ? <input type="hidden" name="ref" value={referralCode} /> : null}
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="registro-nombre">
            Nombre completo *
          </label>
          <Input
            id="registro-nombre"
            type="text"
            name="nombre"
            required
            placeholder="P. ej. Mariana López Rivera"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="registro-email">
            Correo electrónico *
          </label>
          <Input
            id="registro-email"
            type="email"
            name="email"
            required
            placeholder="tucorreo@ejemplo.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="registro-password">
            Contraseña *{' '}
            <span className="font-normal">(mínimo 10 caracteres con letra y número, o una frase de 14+)</span>
          </label>
          <Input
            id="registro-password"
            type="password"
            name="password"
            required
            minLength={10}
            placeholder="Contraseña"
            autoComplete="new-password"
          />
        </div>
        {desktopEdition ? null : <div>
          <span className="mb-1 block text-xs font-medium text-ink-soft">Celular (con indicativo del país)</span>
          <PhoneInput
            dialCode={phone.dialCode}
            number={phone.number}
            onChange={setPhone}
            hiddenNameDialCode="lada"
            hiddenNameNumber="telefono"
            placeholder="Número de celular"
          />
        </div>}

        <label className="flex items-start gap-2 pt-1 text-sm text-ink-soft">
          <input type="checkbox" name="terminos" required className="mt-0.5 accent-primary" />
          <span>
            Acepto los{' '}
            <Link href="/legal/terminos" target="_blank" className="font-medium text-primary dark:text-accent-2 hover:underline">
              términos y condiciones
            </Link>{' '}
            y la{' '}
            <Link href="/legal/privacidad" target="_blank" className="font-medium text-primary dark:text-accent-2 hover:underline">
              política de privacidad
            </Link>
            .
          </span>
        </label>

        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? 'Creando tu cuenta…' : desktopEdition && synchronization === 'drive' ? 'Crear cuenta y preparar Drive' : 'Crear cuenta y empezar'}
        </Button>
      </form>

      {desktopEdition ? <p className="mt-4 rounded-lg bg-bg p-3 text-xs text-ink-soft">Tu correo identifica esta cuenta local; no hace falta verificarlo por internet. Guarda tu contraseña en un lugar seguro: esta edición no incluye recuperación de cuenta por correo.</p> : null}

      <p className="mt-4 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="font-medium text-primary dark:text-accent-2 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
