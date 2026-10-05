'use client';

import { useRef, useState, useTransition } from 'react';
import { Upload } from 'lucide-react';
import { imageToWebp } from '@/components/imageToWebp';
import { uploadFilesAction } from './actions';

const MAX_MB = 20;

export function UploadFiles({ patientId }: { patientId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const tooLarge = files.filter((file) => file.size > MAX_MB * 1024 * 1024);
    const valid = files.filter((file) => file.size <= MAX_MB * 1024 * 1024);
    const localErrors = tooLarge.map((file) => `"${file.name}" supera el límite de ${MAX_MB} MB.`);
    setSuccess(null);
    setMessages(localErrors);
    if (valid.length === 0) return;

    startTransition(async () => {
      try {
        // Las imágenes se convierten a WebP en el navegador antes de subir
        // (v3 §9); PDF y documentos pasan tal cual.
        const prepared = await Promise.all(valid.map((file) => imageToWebp(file)));
        const formData = new FormData();
        for (const file of prepared) formData.append('files', file);
        const result = await uploadFilesAction(patientId, formData);
        setMessages([...localErrors, ...result.errors]);
        if (result.uploaded > 0) {
          setSuccess(
            result.uploaded === 1
              ? 'Se subió 1 archivo correctamente.'
              : `Se subieron ${result.uploaded} archivos correctamente.`,
          );
        }
      } catch {
        setMessages([...localErrors, 'No se pudieron subir los archivos. Intenta nuevamente.']);
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    });
  }

  return (
    <div>
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line bg-surface px-6 py-8 text-center transition-colors hover:border-primary ${
          pending ? 'opacity-60' : ''
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary">
          <Upload size={18} />
        </span>
        <span className="text-sm font-semibold text-primary">
          {pending ? 'Subiendo archivos…' : 'Haz clic para seleccionar archivos'}
        </span>
        <span className="text-xs text-ink-soft">Puedes elegir varios a la vez · máximo {MAX_MB} MB por archivo</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={pending}
          onChange={(event) => handleFiles(event.target.files)}
          className="hidden"
        />
      </label>
      {success ? <p className="mt-2 text-sm text-success">{success}</p> : null}
      {messages.map((message, index) => (
        <p key={index} className="mt-1 text-sm text-danger">
          {message}
        </p>
      ))}
    </div>
  );
}
