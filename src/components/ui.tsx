import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`ei-card rounded-card border border-line bg-surface p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-bg text-ink-soft border border-line',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  primary: 'bg-primary-light text-primary',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center">
      <p className="text-base font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-soft">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Primitivos de formulario y acción (design-system). Calcan las cadenas de
// clases dominantes del código previo para que migrar un elemento crudo a su
// primitivo sea un cambio que preserva comportamiento Y aspecto. La `className`
// del consumidor se concatena AL FINAL, así puede sobreescribir (ancho, fondo
// de solo-lectura, etc.). Sin hooks ni 'use client': usables en RSC y cliente.
// ───────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'outline' | 'danger' | 'soft' | 'ghost' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'ei-button inline-flex items-center justify-center gap-1.5 rounded-xl transition disabled:cursor-not-allowed disabled:opacity-60';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary font-semibold text-white hover:bg-primary-dark',
  outline: 'border border-line bg-surface font-medium text-ink hover:bg-bg',
  danger: 'bg-danger font-semibold text-white hover:opacity-90',
  soft: 'bg-primary-light font-medium text-primary hover:bg-primary hover:text-white',
  ghost: 'font-medium text-ink-soft hover:bg-bg hover:text-ink',
  link: 'font-medium text-primary dark:text-accent-2 hover:underline',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...props },
  ref,
) {
  // `link` es texto en línea: omite base/padding/fondo del resto de variantes.
  const classes =
    variant === 'link'
      ? `font-medium text-primary dark:text-accent-2 transition hover:underline disabled:cursor-not-allowed disabled:opacity-60 ${className}`
      : `${BUTTON_BASE} ${BUTTON_SIZES[size]} ${BUTTON_VARIANTS[variant]} ${className}`;
  // `type` se deja pasar tal cual (sin default): un <button> crudo sin type
  // envía el formulario por defecto, así migrar preserva el comportamiento.
  return <button ref={ref} className={classes.trim()} {...props} />;
});

const FIELD_CONTROL_BASE =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-light disabled:cursor-not-allowed disabled:bg-bg disabled:text-ink-soft disabled:opacity-70';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...props }, ref) {
    return <input ref={ref} className={`${FIELD_CONTROL_BASE} ${className}`.trim()} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className = '', ...props }, ref) {
    return <textarea ref={ref} className={`${FIELD_CONTROL_BASE} ${className}`.trim()} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className = '', children, ...props }, ref) {
    return (
      <select ref={ref} className={`${FIELD_CONTROL_BASE} ${className}`.trim()} {...props}>
        {children}
      </select>
    );
  },
);

export function Label({
  htmlFor,
  required,
  children,
  className = '',
}: {
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={`mb-1 block text-sm font-semibold text-ink ${className}`.trim()}>
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </label>
  );
}

/** Envoltura de campo: etiqueta + control + ayuda/error. Para formularios nuevos. */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className = '',
}: {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  // a11y: cuando hay error, se vincula el control con su mensaje (aria-describedby) y se marca
  // inválido (aria-invalid), y el mensaje lleva role="alert" para que el lector de pantalla lo
  // anuncie al aparecer. El id se deriva del htmlFor del campo (sin hooks → usable también en RSC).
  const errorId = error && htmlFor ? `${htmlFor}-error` : undefined;
  const control =
    errorId && isValidElement(children)
      ? cloneElement(children as ReactElement<Record<string, unknown>>, {
          'aria-invalid': true,
          'aria-describedby': [
            (children.props as Record<string, unknown>)['aria-describedby'],
            errorId,
          ]
            .filter(Boolean)
            .join(' '),
        })
      : children;

  return (
    <div className={className}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
