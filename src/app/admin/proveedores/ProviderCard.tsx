'use client';

import { startTransition, useActionState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button, Input } from '@/components/ui';
import { submitFormWithoutNativeReset } from '@/shared/infrastructure/react/FormActionSubmission';
import { configureProviderAction, type ProviderFormState } from './actions';

const INITIAL: ProviderFormState = {};

export interface ProviderCardField {
  key: string;
  label: string;
  placeholder?: string;
  secret?: boolean;
}

export interface ProviderCardData {
  id: string;
  name: string;
  description: string;
  fields: ProviderCardField[];
  status: 'simulado' | 'configurado';
  config: Record<string, string>;
  updatedAt: string | null;
}

export function ProviderCard({ provider }: { provider: ProviderCardData }) {
  const [state, dispatch, pending] = useActionState(configureProviderAction, INITIAL);

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-1 flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold text-ink">{provider.name}</h2>
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            provider.status === 'configurado' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'
          }`}
        >
          {provider.status === 'configurado' ? 'Configurado' : 'Simulado'}
        </span>
      </div>
      <p className="mb-4 text-sm text-ink-soft">{provider.description}</p>

      <form
        action={dispatch}
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          submitFormWithoutNativeReset(event, () => {
            startTransition(() => dispatch(formData));
          });
        }}
        className="space-y-3"
      >
        <input type="hidden" name="proveedor" value={provider.id} />
        {provider.fields.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor={`${provider.id}-${field.key}`}>
              {field.label}
            </label>
            <Input
              id={`${provider.id}-${field.key}`}
              type={field.secret ? 'password' : 'text'}
              name={`cfg_${field.key}`}
              defaultValue={provider.config[field.key] ?? ''}
              placeholder={field.placeholder}
              autoComplete="off"
            />
          </div>
        ))}

        {state.error ? <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger">{state.error}</p> : null}
        {state.ok ? <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">{state.ok}</p> : null}

        <div className="flex items-center justify-between gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
          {provider.updatedAt ? (
            <span className="text-xs text-ink-soft">
              Actualizado el {format(new Date(provider.updatedAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
