'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Circle, MessageSquare, Save } from 'lucide-react';
import { Badge, Button } from '@/components/ui';
import { saveSupervisionReviewAction } from '../../../../../actions';

/**
 * Caja de retroalimentación ACADÉMICA del supervisor (v3.2). La nota clínica
 * permanece en solo lectura: aquí solo se escribe el comentario del supervisor
 * (cada supervisor edita únicamente su propia retroalimentación) y la marca
 * "revisada". El supervisado recibe una notificación al guardar.
 */
export function ReviewPanel({
  noteId,
  supervisedUserId,
  patientId,
  supervisedName,
  initialComment,
  initialReviewed,
  initialUpdatedAt,
}: {
  noteId: string;
  supervisedUserId: string;
  patientId: string;
  supervisedName: string;
  initialComment: string;
  initialReviewed: boolean;
  initialUpdatedAt: string | null;
}) {
  const [comment, setComment] = useState(initialComment);
  const [savedComment, setSavedComment] = useState(initialComment);
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialUpdatedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveComment() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await saveSupervisionReviewAction({
        noteId,
        supervisedUserId,
        patientId,
        comment,
      });
      if (result.ok) {
        setComment(result.review.comment);
        setSavedComment(result.review.comment);
        setReviewed(result.review.reviewed);
        setUpdatedAt(result.review.updatedAt);
      } else {
        setError(result.error);
      }
    });
  }

  function toggleReviewed() {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await saveSupervisionReviewAction({
        noteId,
        supervisedUserId,
        patientId,
        reviewed: !reviewed,
      });
      if (result.ok) {
        setReviewed(result.review.reviewed);
        setUpdatedAt(result.review.updatedAt);
      } else {
        setError(result.error);
      }
    });
  }

  const dirty = comment.trim() !== savedComment;

  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquare size={17} className="text-primary" />
          <h2 className="text-base font-bold text-ink">Retroalimentación del supervisor</h2>
        </div>
        <Badge tone={reviewed ? 'success' : 'neutral'}>
          {reviewed ? 'Revisada ✓' : 'Sin revisar'}
        </Badge>
      </div>

      <p className="mb-3 text-xs text-ink-soft">
        Retroalimentación académica para {supervisedName}: la verá en su nota y recibirá una
        notificación. La nota clínica permanece en solo lectura.
      </p>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={5}
        placeholder="Escribe tu retroalimentación sobre esta nota de sesión…"
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
      />

      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={saveComment}
            disabled={pending || !dirty}
          >
            <Save size={15} /> {pending ? 'Guardando…' : 'Guardar retroalimentación'}
          </Button>
          <button
            type="button"
            onClick={toggleReviewed}
            disabled={pending}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
              reviewed
                ? 'border-success/40 bg-success-soft text-success hover:border-success'
                : 'border-line bg-surface text-ink hover:border-primary hover:text-primary'
            }`}
          >
            {reviewed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
            {reviewed ? 'Marcar como no revisada' : 'Marcar como revisada'}
          </button>
        </div>
        {updatedAt ? (
          <p className="text-xs text-ink-soft">
            Última actualización:{' '}
            {format(new Date(updatedAt), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
