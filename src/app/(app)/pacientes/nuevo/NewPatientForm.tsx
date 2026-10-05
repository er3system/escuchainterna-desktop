'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { DOCUMENT_TYPES } from '@/contexts/patients/domain/value-objects/documentTypes';
import { isMinor } from '@/contexts/patients/domain/value-objects/minor';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { createPatientAction, type CreatePatientFormInput } from '../actions';

function Label({ htmlFor, children, required }: { htmlFor: string; children: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-ink">
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </label>
  );
}

export function NewPatientForm() {
  const router = useRouter();
  const [phone, setPhone] = useState({ dialCode: '+57', number: '' });
  const [emergencyPhone, setEmergencyPhone] = useState({ dialCode: '+57', number: '' });
  // Fecha de nacimiento controlada solo para resaltar la sección del representante
  // legal cuando el paciente es menor de edad (la captura sigue siendo opcional).
  const [birthDate, setBirthDate] = useState('');
  const minor = isMinor(birthDate.trim() || null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  // Valores pendientes de confirmar cuando el documento choca con otro paciente (§5.6).
  // Se conservan en estado (no en el DOM) para que "Crear de todos modos" no los pierda.
  const [pendingValues, setPendingValues] = useState<CreatePatientFormInput | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(input: CreatePatientFormInput) {
    startTransition(async () => {
      const result = await createPatientAction(input);
      if (result.ok) {
        router.push(`/pacientes?creado=${encodeURIComponent(result.patientName ?? '')}`);
      } else if (result.duplicateWarning) {
        setError(null);
        setDuplicateWarning(result.duplicateWarning);
        setPendingValues(input);
      } else {
        setDuplicateWarning(null);
        setPendingValues(null);
        setError(result.error ?? 'No se pudo crear al paciente.');
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const read = (key: string) => String(data.get(key) ?? '');
    submit({
      nombre: read('nombre'),
      correo: read('correo'),
      telefono: read('telefono'),
      lada: read('lada'),
      fechaNacimiento: read('fecha_nacimiento'),
      genero: read('genero'),
      motivoConsulta: read('motivo_consulta'),
      fechaInicioTerapia: read('fecha_inicio_terapia'),
      contactoEmergencia: read('contacto_emergencia'),
      telefonoEmergencia: read('telefono_emergencia'),
      ladaEmergencia: read('lada_emergencia'),
      notas: read('notas'),
      etiquetas: read('etiquetas'),
      documentoTipo: read('documento_tipo'),
      documentoNumero: read('documento_numero'),
      representanteNombre: read('representante_nombre'),
      representanteParentesco: read('representante_parentesco'),
      representanteDocumento: read('representante_documento'),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-card border border-line bg-surface p-6 shadow-card">
      <h2 className="mb-4 text-base font-bold text-ink">Datos del paciente</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="nombre" required>
            Nombre:
          </Label>
          <Input id="nombre" name="nombre" type="text" required placeholder="Juan Pérez" />
        </div>
        <div>
          <Label htmlFor="correo">Correo electrónico:</Label>
          <Input id="correo" name="correo" type="email" placeholder="nombre@ejemplo.com" />
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink">Teléfono:</span>
          <PhoneInput
            dialCode={phone.dialCode}
            number={phone.number}
            onChange={setPhone}
            hiddenNameDialCode="lada"
            hiddenNameNumber="telefono"
            placeholder="Número de teléfono"
          />
          <p className="mt-1 text-xs text-ink-soft">
            Elige la lada del país y escribe el número sin prefijo. Sin un teléfono válido no llegarán
            mensajes de WhatsApp.
          </p>
        </div>
        <div>
          <Label htmlFor="documento_tipo">Tipo de documento:</Label>
          <Select id="documento_tipo" name="documento_tipo" defaultValue="">
            <option value="">Sin especificar</option>
            {DOCUMENT_TYPES.map((doc) => (
              <option key={doc.key} value={doc.key}>
                {doc.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="documento_numero">Número de documento:</Label>
          <Input
            id="documento_numero"
            name="documento_numero"
            type="text"
            inputMode="numeric"
            placeholder="Número de identificación"
          />
        </div>
        <div>
          <Label htmlFor="fecha_nacimiento">Fecha de nacimiento:</Label>
          <Input
            id="fecha_nacimiento"
            name="fecha_nacimiento"
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
          {minor ? (
            <p className="mt-1 text-xs font-medium text-warning">
              El paciente es menor de edad. Registra a su representante legal (acudiente) más abajo.
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="genero">Género:</Label>
          <Select id="genero" name="genero" defaultValue="">
            <option value="">Selecciona una opción…</option>
            <option value="femenino">Femenino</option>
            <option value="masculino">Masculino</option>
            <option value="no_binario">No binario</option>
            <option value="prefiere_no_decir">Prefiere no decir</option>
            <option value="otro">Otro</option>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="motivo_consulta">Motivo de consulta:</Label>
          <Textarea
            id="motivo_consulta"
            name="motivo_consulta"
            rows={3}
            placeholder="Escriba una razón..."
          />
        </div>
        <div>
          <Label htmlFor="fecha_inicio_terapia">Fecha de inicio de terapia:</Label>
          <Input id="fecha_inicio_terapia" name="fecha_inicio_terapia" type="date" />
        </div>
        <div>
          <Label htmlFor="etiquetas">Etiquetas:</Label>
          <Input
            id="etiquetas"
            name="etiquetas"
            type="text"
            placeholder="Primera vez, Pago anticipado"
          />
          <p className="mt-1 text-xs text-ink-soft">Separa las etiquetas con comas.</p>
        </div>
      </div>

      <h2 className="mb-4 mt-6 text-base font-bold text-ink">Contacto de emergencia</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contacto_emergencia">Nombre:</Label>
          <Input
            id="contacto_emergencia"
            name="contacto_emergencia"
            type="text"
            placeholder="María García"
          />
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-ink">Teléfono:</span>
          <PhoneInput
            dialCode={emergencyPhone.dialCode}
            number={emergencyPhone.number}
            onChange={setEmergencyPhone}
            hiddenNameDialCode="lada_emergencia"
            hiddenNameNumber="telefono_emergencia"
            placeholder="Número de teléfono"
          />
        </div>
      </div>

      <div
        className={`mt-6 rounded-card border p-4 transition-colors ${
          minor ? 'border-warning/50 bg-warning-soft' : 'border-line bg-bg/40'
        }`}
      >
        <h2 className="flex items-center gap-1.5 text-base font-bold text-ink">
          <Users size={17} className={minor ? 'text-warning' : 'text-primary/70'} />
          Representante legal (acudiente)
        </h2>
        <p className="mt-1 text-xs text-ink-soft">
          Obligatorio para pacientes menores de edad. Quien firma el consentimiento informado en
          nombre del menor.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="representante_nombre">Nombre del representante:</Label>
            <Input
              id="representante_nombre"
              name="representante_nombre"
              type="text"
              placeholder="Nombre y apellido del acudiente"
            />
          </div>
          <div>
            <Label htmlFor="representante_parentesco">Parentesco / relación:</Label>
            <Input
              id="representante_parentesco"
              name="representante_parentesco"
              type="text"
              placeholder="Madre, padre, tutor legal…"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="representante_documento">Documento del representante:</Label>
            <Input
              id="representante_documento"
              name="representante_documento"
              type="text"
              placeholder="Número de identificación del acudiente"
            />
          </div>
        </div>
      </div>

      <h2 className="mb-4 mt-6 text-base font-bold text-ink">Notas</h2>
      <Textarea
        name="notas"
        rows={3}
        placeholder="Añade aquí cualquier detalle sobre el paciente"
        aria-label="Notas:"
      />

      <div className="mt-2 min-h-5 space-y-2">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {duplicateWarning ? (
          <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-ink">
            {duplicateWarning}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Link
          href="/pacientes"
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:bg-bg"
        >
          Cancelar
        </Link>
        {duplicateWarning && pendingValues ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => submit({ ...pendingValues, confirmDuplicate: true })}
            className="rounded-lg border border-warning bg-warning/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-warning/20 disabled:opacity-60"
          >
            Crear de todos modos
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {pending ? 'Creando…' : 'Crear paciente'}
        </button>
      </div>
    </form>
  );
}
