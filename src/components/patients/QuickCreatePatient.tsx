'use client';

import { useState, useTransition } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Input } from '@/components/ui';
import { PhoneInput } from '@/components/PhoneInput';
import { createPatientAction } from '@/app/(app)/pacientes/actions';

/**
 * Alta MÍNIMA de paciente desde el flujo de Vínculos: nombre (obligatorio) y
 * teléfono (opcional). No usa <form action> para poder vivir DENTRO del formulario
 * de creación de caso sin anidar formularios: llama a la server action por JS y, al
 * crear, avisa al padre con el id del paciente nuevo para preseleccionarlo.
 */
export function QuickCreatePatient({
  onCreated,
  onCancel,
}: {
  onCreated: (patient: { id: string; fullName: string }) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [lada, setLada] = useState('+57');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = nombre.trim();
    if (!trimmed) {
      setError('Escribe el nombre del paciente.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createPatientAction({
        nombre: trimmed,
        correo: '',
        telefono: telefono.trim(),
        lada,
        fechaNacimiento: '',
        genero: '',
        motivoConsulta: '',
        fechaInicioTerapia: '',
        contactoEmergencia: '',
        telefonoEmergencia: '',
        ladaEmergencia: '',
        notas: '',
        etiquetas: '',
        documentoTipo: '',
        documentoNumero: '',
        representanteNombre: '',
        representanteParentesco: '',
        representanteDocumento: '',
      });
      if (!result.ok || !result.patientId) {
        setError(result.error ?? result.duplicateWarning ?? 'No se pudo crear el paciente.');
        return;
      }
      onCreated({ id: result.patientId, fullName: result.patientName ?? trimmed });
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-primary/30 dark:border-accent-2/25 bg-primary-light/30 dark:bg-primary/15 p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <UserPlus size={15} className="text-primary dark:text-accent-2" /> Crear perfil rápido
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-ink-soft transition hover:text-ink"
          aria-label="Cancelar"
        >
          <X size={15} />
        </button>
      </div>
      <p className="text-xs text-ink-soft">
        Solo el nombre es obligatorio. Podrás completar el resto del perfil más tarde.
      </p>
      <Input
        type="text"
        value={nombre}
        autoFocus
        onChange={(event) => {
          setNombre(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Nombre y apellido"
      />
      <PhoneInput
        dialCode={lada}
        number={telefono}
        onChange={(next) => {
          setLada(next.dialCode);
          setTelefono(next.number);
        }}
        placeholder="Teléfono (opcional)"
      />
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <UserPlus size={14} /> {pending ? 'Creando…' : 'Crear y seleccionar'}
        </button>
      </div>
    </div>
  );
}
