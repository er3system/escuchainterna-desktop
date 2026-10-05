'use client';

import { useActionState, useState, useTransition } from 'react';
import { Building2, Globe, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { imageToWebp } from '@/components/imageToWebp';
import { removeLogoAction, updateBrandingAction, type BrandingState } from '../actions';

/**
 * Branding de la organización: logo (data/uploads/orgs/<orgId>/) y slug con
 * vista previa del subdominio que tendrá en producción.
 */
export function BrandingForm({
  organizationId,
  organizationName,
  currentSlug,
  hasLogo,
  logoVersion,
}: {
  organizationId: string;
  organizationName: string;
  currentSlug: string;
  hasLogo: boolean;
  logoVersion: string;
}) {
  const [state, formAction, pending] = useActionState<BrandingState, FormData>(
    updateBrandingAction,
    {},
  );
  const [slug, setSlug] = useState(currentSlug);
  const [removingLogo, startRemoveTransition] = useTransition();
  const previewSlug = slug.trim().toLowerCase() || currentSlug;

  return (
    <form
      action={async (formData: FormData) => {
        // v3 §9: el logo se convierte a WebP en el navegador antes de subirse
        // (PNG/JPG → WebP; SVG y WebP pasan tal cual).
        const logo = formData.get('logo');
        if (logo instanceof File && logo.size > 0) {
          formData.set('logo', await imageToWebp(logo));
        }
        formAction(formData);
      }}
      className="space-y-5"
    >
      <div>
        <p className="mb-1 text-sm font-medium text-ink">Logo de la organización</p>
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-card border border-line bg-bg">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/organizaciones/${organizationId}/logo?v=${logoVersion}`}
                alt={`Logo de ${organizationName}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 size={24} className="text-ink-soft" />
            )}
          </span>
          <div className="space-y-1.5">
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="block text-sm text-ink-soft file:mr-3 file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-bg"
            />
            <p className="text-xs text-ink-soft">PNG, JPG, WebP o SVG · máximo 2 MB.</p>
            {hasLogo ? (
              <button
                type="button"
                disabled={removingLogo}
                onClick={() => {
                  if (window.confirm('¿Quitar el logo de la organización?')) {
                    startRemoveTransition(() => removeLogoAction());
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-danger disabled:opacity-60"
              >
                <Trash2 size={12} /> Quitar logo actual
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          El logo aparece en el sidebar de tus miembros (junto al de EscuchaInterna), en sus páginas
          públicas de reservas y en los correos del equipo.
        </p>
      </div>

      <div>
        <label htmlFor="branding-slug" className="mb-1 block text-sm font-medium text-ink">
          Identificador (slug)
        </label>
        <input
          id="branding-slug"
          type="text"
          name="slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="mi-organizacion"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          title="Solo minúsculas, números y guiones (ej. clinica-aurora)"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none sm:w-72"
        />
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-light px-3 py-1.5 text-xs font-medium text-primary">
          <Globe size={14} /> Vista previa de tu dominio: {previewSlug}.escuchainterna.com
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          En producción tu organización tendrá su propio subdominio con este identificador.
        </p>
      </div>

      {state.error ? <p className="text-sm font-medium text-danger">{state.error}</p> : null}
      {state.ok ? <p className="text-sm font-medium text-success">Branding guardado.</p> : null}

      <Button type="submit" disabled={pending}>
        <Save size={16} /> {pending ? 'Guardando…' : 'Guardar branding'}
      </Button>
    </form>
  );
}
