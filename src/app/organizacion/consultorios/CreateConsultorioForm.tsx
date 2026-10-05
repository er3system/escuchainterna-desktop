'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Building2 } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { createConsultorioAction, type ConsultorioState } from '../actions';

/** Alta de un consultorio (sub-unidad de la organización). Fase 1: solo estructura. */
export function CreateConsultorioForm() {
  const [state, formAction, pending] = useActionState<ConsultorioState, FormData>(
    createConsultorioAction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div>
        <label htmlFor="consultorio-name" className="mb-1 block text-sm font-medium text-ink">
          Nombre del consultorio
        </label>
        <Input
          id="consultorio-name"
          type="text"
          name="name"
          required
          placeholder="p. ej. Sede Centro"
        />
      </div>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium text-success">Consultorio creado.</p> : null}

      <Button type="submit" disabled={pending}>
        <Building2 size={16} /> {pending ? 'Creando…' : 'Crear consultorio'}
      </Button>
    </form>
  );
}
