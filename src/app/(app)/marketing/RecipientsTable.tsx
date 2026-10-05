'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { differenceInCalendarMonths } from 'date-fns';
import { Check, Eye, Search, Send, SlidersHorizontal, Users } from 'lucide-react';
import { Button, Input, Textarea } from '@/components/ui';
import { EmailPreviewFrame } from '../mensajes/EmailPreviewFrame';
import {
  EMAIL_THEMES,
  type EmailSenderData,
  type EmailThemeId,
} from '@/shared/infrastructure/email-themes/emailThemes';
import type { SegmentationRecipient } from '@/contexts/marketing/domain/repositories/RecipientDirectory';
import type { EffectiveMessageTemplate } from '@/contexts/marketing/application/get-effective-templates/GetEffectiveTemplates';
import { sendMassEmailAction, type MarketingActionState } from './actions';

const INITIAL: MarketingActionState = {};

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const NO_GENDER = '__sin__';

type AudienceMode = 'seleccion' | 'todos' | 'filtros';

interface RecipientFilters {
  tags: string[];
  estado: 'activos' | 'archivados' | 'todos';
  ultimaSesion: 'cualquiera' | 'mas_de' | 'menos_de' | 'sin_sesiones';
  meses: number;
  genero: string;
  cumpleMes: number;
}

const DEFAULT_FILTERS: RecipientFilters = {
  tags: [],
  estado: 'activos',
  ultimaSesion: 'cualquiera',
  meses: 3,
  genero: '',
  cumpleMes: 0,
};

function applyFilters(recipients: SegmentationRecipient[], filters: RecipientFilters): SegmentationRecipient[] {
  const now = new Date();
  return recipients.filter((recipient) => {
    if (filters.estado === 'activos' && recipient.archived) return false;
    if (filters.estado === 'archivados' && !recipient.archived) return false;
    if (filters.tags.length > 0 && !filters.tags.some((tag) => recipient.tags.includes(tag))) return false;
    if (filters.ultimaSesion === 'sin_sesiones') {
      if (recipient.lastSessionAt) return false;
    } else if (filters.ultimaSesion !== 'cualquiera') {
      if (!recipient.lastSessionAt) return false;
      const months = differenceInCalendarMonths(now, new Date(recipient.lastSessionAt));
      if (filters.ultimaSesion === 'mas_de' && months < filters.meses) return false;
      if (filters.ultimaSesion === 'menos_de' && months >= filters.meses) return false;
    }
    if (filters.genero !== '') {
      const gender = recipient.gender.trim().toLowerCase();
      if (filters.genero === NO_GENDER) {
        if (gender !== '') return false;
      } else if (gender !== filters.genero) {
        return false;
      }
    }
    if (filters.cumpleMes > 0) {
      if (!recipient.birthDate) return false;
      if (Number(recipient.birthDate.slice(5, 7)) !== filters.cumpleMes) return false;
    }
    return true;
  });
}

const norm = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Sustituye los tokens por valores de muestra para que la vista previa se vea real. */
function substitutePreview(body: string, senderName: string, scheduleLink: string): string {
  return body
    .replaceAll('{{nombre}}', 'Andrés')
    .replaceAll('{{profesional}}', senderName)
    .replaceAll('{{liga_agenda}}', scheduleLink || 'https://tu-liga-de-agenda');
}

export function RecipientsTable({
  allRecipients,
  templates,
  theme,
  sender,
  senderName,
  scheduleLink,
}: {
  allRecipients: SegmentationRecipient[];
  templates: EffectiveMessageTemplate[];
  theme: EmailThemeId;
  sender: EmailSenderData;
  senderName: string;
  scheduleLink: string;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [selectQuery, setSelectQuery] = useState('');
  const [mode, setMode] = useState<AudienceMode>('todos');
  const [filters, setFilters] = useState<RecipientFilters>(DEFAULT_FILTERS);
  const [templateKey, setTemplateKey] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [state, dispatch, pending] = useActionState(sendMassEmailAction, INITIAL);

  // Este formulario sí es transaccional: tras un envío exitoso se limpia la
  // composición. Sincronizamos también el estado React para que el reset nativo
  // de la Form Action no deje selects/checkboxes visualmente distintos al estado.
  useEffect(() => {
    if (!state.ok) return;
    setSelected(new Set());
    setSelectQuery('');
    setMode('todos');
    setFilters(DEFAULT_FILTERS);
    setTemplateKey('');
    setSubject('');
    setBody('');
  }, [state]);

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const selectedIds = useMemo(() => [...selected], [selected]);

  // Pacientes elegibles para selección manual (activos), buscables en vivo.
  const selectable = useMemo(() => allRecipients.filter((r) => !r.archived), [allRecipients]);
  const visibleSelectable = useMemo(() => {
    const q = norm(selectQuery.trim());
    if (!q) return selectable;
    return selectable.filter((r) => norm(`${r.fullName} ${r.email}`).includes(q));
  }, [selectable, selectQuery]);
  const allVisibleSelected =
    visibleSelectable.length > 0 && visibleSelectable.every((r) => selected.has(r.id));
  const toggleAllVisible = () => {
    const next = new Set(selected);
    if (allVisibleSelected) visibleSelectable.forEach((r) => next.delete(r.id));
    else visibleSelectable.forEach((r) => next.add(r.id));
    setSelected(next);
  };
  const selectedWithEmail = useMemo(
    () => selectable.filter((r) => selected.has(r.id) && r.email.trim() !== '').length,
    [selectable, selected],
  );

  const availableTags = useMemo(
    () => [...new Set(allRecipients.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'es')),
    [allRecipients],
  );
  const availableGenders = useMemo(
    () =>
      [...new Set(allRecipients.map((r) => r.gender.trim().toLowerCase()).filter((g) => g !== ''))].sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [allRecipients],
  );

  const filtered = useMemo(() => applyFilters(allRecipients, filters), [allRecipients, filters]);
  const filteredWithEmail = useMemo(() => filtered.filter((r) => r.email.trim() !== ''), [filtered]);

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const template = templates.find((candidate) => candidate.key === key);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };
  const clearTemplate = () => {
    setTemplateKey('');
    setSubject('');
    setBody('');
  };

  const updateFilters = (next: Partial<RecipientFilters>) => setFilters((current) => ({ ...current, ...next }));
  const toggleTag = (tag: string) =>
    setFilters((current) => ({
      ...current,
      tags: current.tags.includes(tag) ? current.tags.filter((item) => item !== tag) : [...current.tags, tag],
    }));

  const audienceIds = mode === 'seleccion' ? selectedIds : mode === 'filtros' ? filtered.map((r) => r.id) : [];
  const audienceCount = mode === 'seleccion' ? selected.size : mode === 'filtros' ? filtered.length : null;
  const currentMonth = new Date().getMonth() + 1;

  const previewBody = body.trim() ? substitutePreview(body, senderName, scheduleLink) : 'Tu mensaje aparecerá aquí…';
  const themeName = EMAIL_THEMES.find((entry) => entry.id === theme)?.name ?? 'tu tema';
  const canSend = !pending && subject.trim() !== '' && body.trim() !== '' && (mode === 'todos' || audienceIds.length > 0);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink">
          <Send size={17} className="text-primary dark:text-accent-2" /> Nueva campaña
        </h2>
      </div>
      <form action={dispatch} className="grid gap-6 p-5 lg:grid-cols-[1fr_22rem]">
        {/* --- Columna izquierda: el formulario guiado --- */}
        <div className="min-w-0 space-y-5">
          {/* Paso 1: audiencia */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              1 · ¿A quién le escribes?
            </p>
            <div className="flex flex-wrap gap-2">
              <AudiencePill active={mode === 'todos'} onClick={() => setMode('todos')} label="Todos con correo" />
              <AudiencePill
                active={mode === 'filtros'}
                onClick={() => setMode('filtros')}
                label="Filtrar"
                icon={<SlidersHorizontal size={13} />}
              />
              <AudiencePill
                active={mode === 'seleccion'}
                onClick={() => setMode('seleccion')}
                label={selected.size > 0 ? `Seleccionar (${selected.size})` : 'Seleccionar'}
                icon={<Check size={13} />}
              />
            </div>

            {/* Modo SELECCIONAR: buscar + elegir varios in situ */}
            {mode === 'seleccion' ? (
              <div className="mt-3 rounded-lg border border-line bg-bg p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search
                      size={14}
                      className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft"
                    />
                    <input
                      type="search"
                      value={selectQuery}
                      onChange={(event) => setSelectQuery(event.target.value)}
                      placeholder="Buscar por nombre o correo"
                      className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-sm text-ink outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
                  >
                    {allVisibleSelected ? 'Quitar todos' : 'Elegir todos'}
                  </button>
                </div>
                <div className="max-h-60 divide-y divide-line/70 overflow-y-auto rounded-lg border border-line bg-surface">
                  {visibleSelectable.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-ink-soft">
                      {selectQuery ? 'Nadie coincide con tu búsqueda.' : 'No hay pacientes para elegir.'}
                    </p>
                  ) : (
                    visibleSelectable.map((recipient) => (
                      <label
                        key={recipient.id}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-bg"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(recipient.id)}
                          onChange={() => toggleOne(recipient.id)}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{recipient.fullName}</span>
                          <span className="block truncate text-xs text-ink-soft">
                            {recipient.email || 'Sin correo'}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            {/* Modo FILTRAR: segmentación */}
            {mode === 'filtros' ? (
              <div className="mt-3 space-y-3 rounded-lg bg-bg p-3">
                {availableTags.length > 0 ? (
                  <div>
                    <p className="mb-1 text-xs font-semibold text-ink">Etiquetas (cualquiera de las marcadas)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            filters.tags.includes(tag)
                              ? 'bg-primary text-white'
                              : 'bg-surface text-ink-soft hover:text-ink'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-ink">
                    Estado
                    <select
                      value={filters.estado}
                      onChange={(event) => updateFilters({ estado: event.target.value as RecipientFilters['estado'] })}
                      className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-normal text-ink"
                    >
                      <option value="activos">Activos</option>
                      <option value="archivados">Archivados</option>
                      <option value="todos">Todos</option>
                    </select>
                  </label>

                  <label className="block text-xs font-semibold text-ink">
                    Género
                    <select
                      value={filters.genero}
                      onChange={(event) => updateFilters({ genero: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-normal text-ink"
                    >
                      <option value="">Cualquiera</option>
                      {availableGenders.map((gender) => (
                        <option key={gender} value={gender}>
                          {gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </option>
                      ))}
                      <option value={NO_GENDER}>Sin especificar</option>
                    </select>
                  </label>

                  <div className="text-xs font-semibold text-ink">
                    Última sesión
                    <div className="mt-1 flex items-center gap-2">
                      <select
                        value={filters.ultimaSesion}
                        onChange={(event) =>
                          updateFilters({ ultimaSesion: event.target.value as RecipientFilters['ultimaSesion'] })
                        }
                        aria-label="Filtro de última sesión"
                        className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-normal text-ink"
                      >
                        <option value="cualquiera">Cualquiera</option>
                        <option value="mas_de">Hace más de…</option>
                        <option value="menos_de">Hace menos de…</option>
                        <option value="sin_sesiones">Sin sesiones</option>
                      </select>
                      {filters.ultimaSesion === 'mas_de' || filters.ultimaSesion === 'menos_de' ? (
                        <span className="flex items-center gap-1 text-sm font-normal text-ink">
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={filters.meses}
                            onChange={(event) => updateFilters({ meses: Math.max(1, Number(event.target.value) || 1) })}
                            aria-label="Meses"
                            className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                          />
                          meses
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <label className="block text-xs font-semibold text-ink">
                    Cumpleaños en
                    <select
                      value={filters.cumpleMes}
                      onChange={(event) => updateFilters({ cumpleMes: Number(event.target.value) })}
                      className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-normal text-ink"
                    >
                      <option value={0}>Cualquier mes</option>
                      {MONTH_NAMES.map((name, index) => (
                        <option key={name} value={index + 1}>
                          {name}
                          {index + 1 === currentMonth ? ' (este mes)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : null}

            <p
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-light/50 dark:bg-primary/20 px-3 py-1.5 text-sm text-ink"
              aria-live="polite"
            >
              <Users size={14} className="text-primary dark:text-accent-2" />
              {mode === 'todos' ? (
                <span>Todos tus pacientes activos con correo</span>
              ) : mode === 'seleccion' ? (
                <span>
                  <span className="font-semibold">{selected.size}</span>{' '}
                  {selected.size === 1 ? 'elegido' : 'elegidos'} · {selectedWithEmail} con correo
                </span>
              ) : (
                <span>
                  <span className="font-semibold">{filtered.length}</span> cumplen los filtros ·{' '}
                  {filteredWithEmail.length} con correo
                </span>
              )}
            </p>
          </div>

          {/* Inputs ocultos de audiencia para el envío */}
          {mode === 'todos' ? (
            <input type="hidden" name="todos" value="1" />
          ) : (
            audienceIds.map((id) => <input key={id} type="hidden" name="destinatario" value={id} />)
          )}

          {/* Paso 2: mensaje */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">2 · El mensaje</p>
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {templates.slice(0, 6).map((template) => (
                <button
                  key={template.key}
                  type="button"
                  onClick={() => applyTemplate(template.key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    templateKey === template.key
                      ? 'bg-primary text-white'
                      : 'border border-line bg-surface text-ink-soft hover:text-ink'
                  }`}
                >
                  {template.name}
                </button>
              ))}
              <button
                type="button"
                onClick={clearTemplate}
                className="rounded-full border border-dashed border-line px-3 py-1 text-xs font-medium text-ink-soft transition hover:text-ink"
              >
                En blanco
              </button>
            </div>
            <Input
              name="asunto"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Asunto del correo"
              className="mb-2"
              aria-label="Asunto"
            />
            <Textarea
              name="mensaje"
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Escribe tu mensaje…"
              aria-label="Mensaje"
            />
            <p className="mt-1.5 text-xs text-ink-soft">
              Variables: <code>{'{{nombre}}'}</code>, <code>{'{{profesional}}'}</code>,{' '}
              <code>{'{{liga_agenda}}'}</code> se reemplazan al enviar. En modo local los correos se registran sin
              enviarse.
            </p>
          </div>

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state.ok ? <p className="text-sm font-medium text-success">{state.ok}</p> : null}

          <Button type="submit" size="lg" disabled={!canSend}>
            <Send size={15} />{' '}
            {pending ? 'Enviando…' : mode === 'todos' ? 'Enviar a todos' : `Enviar a ${audienceCount}`}
          </Button>
        </div>

        {/* --- Columna derecha: vista previa en vivo --- */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-soft">
            <Eye size={13} /> Vista previa · tema {themeName}
          </p>
          <EmailPreviewFrame
            theme={theme}
            body={previewBody}
            sender={sender}
            className="h-[26rem] w-full rounded-lg border border-line bg-white"
          />
          <p className="mt-2 text-center text-xs text-ink-soft">
            Cambia el tema en{' '}
            <a href="/mensajes?tab=plantillas" className="font-medium text-primary dark:text-accent-2 hover:underline">
              Plantillas
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}

function AudiencePill({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active ? 'bg-primary text-white' : 'border border-line bg-surface text-ink-soft hover:text-ink'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
