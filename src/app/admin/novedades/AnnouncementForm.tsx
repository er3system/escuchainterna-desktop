'use client';

import { useActionState } from 'react';
import { Send } from 'lucide-react';
import {
  ANNOUNCEMENT_AUDIENCES,
  ANNOUNCEMENT_AUDIENCE_LABELS,
} from '@/contexts/notifications/domain/Announcement';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { publishAnnouncementAction, type AnnouncementFormState } from './actions';

const INITIAL: AnnouncementFormState = {};

export function AnnouncementForm() {
  const [state, dispatch, pending] = useActionState(publishAnnouncementAction, INITIAL);

  return (
    <form action={dispatch} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="novedad-titulo">
          Título *
        </label>
        <Input
          id="novedad-titulo"
          name="titulo"
          type="text"
          required
          placeholder="P. ej. Nueva biblioteca clínica disponible"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="novedad-cuerpo">
          Cuerpo
        </label>
        <Textarea
          id="novedad-cuerpo"
          name="cuerpo"
          rows={4}
          placeholder="Describe la novedad con el detalle necesario."
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft" htmlFor="novedad-audiencia">
          Audiencia
        </label>
        <Select id="novedad-audiencia" name="audiencia" defaultValue="todos">
          {ANNOUNCEMENT_AUDIENCES.map((audience) => (
            <option key={audience} value={audience}>
              {ANNOUNCEMENT_AUDIENCE_LABELS[audience]}
            </option>
          ))}
        </Select>
      </div>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-success">{state.ok}</p> : null}

      <Button type="submit" disabled={pending}>
        <Send size={15} /> {pending ? 'Publicando…' : 'Publicar novedad'}
      </Button>
    </form>
  );
}
