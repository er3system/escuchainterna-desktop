'use client';

import { useState, useTransition } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, Send } from 'lucide-react';
import { Badge } from '@/components/ui';
import { askQuestionAction } from '../actions';

interface QuestionItem {
  question: string;
  response: string;
  createdAt: string;
}

/** Prompts de arranque orientados a consultoría clínica (no a "reportar"). */
const SUGGESTED = [
  'Recomiéndame una técnica para lo que aparece en esta sesión',
  '¿Qué opinas de la evolución de este caso?',
  'Diseña una intervención para las próximas sesiones',
];

export function AiPanel({
  noteId,
  patientId,
  provider,
  initialQuestions,
}: {
  noteId: string;
  patientId: string;
  provider: 'local' | 'anthropic';
  initialQuestions: QuestionItem[];
}) {
  const [questions, setQuestions] = useState<QuestionItem[]>(initialQuestions);
  const [questionInput, setQuestionInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(text?: string) {
    const question = (text ?? questionInput).trim();
    if (question === '' || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await askQuestionAction(noteId, patientId, question);
      if (result.ok) {
        setQuestions((previous) => [
          ...previous,
          { question, response: result.response, createdAt: result.createdAt },
        ]);
        setQuestionInput('');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-primary" />
          <h3 className="font-bold text-ink">Preguntar a la IA</h3>
        </div>
        <Badge tone={provider === 'anthropic' ? 'primary' : 'neutral'}>
          {provider === 'anthropic' ? 'Claude' : 'IA local'}
        </Badge>
      </div>

      <div className="flex flex-col">
        <div className="max-h-96 space-y-4 overflow-y-auto p-4">
          {questions.length === 0 ? (
            <div className="py-4 text-center">
              <p className="mb-3 text-sm text-ink-soft">
                Consulta clínica sobre esta sesión: técnicas, evolución del caso, ideas de
                intervención. Analiza el contenido guardado de la nota.
              </p>
              <div className="flex flex-col gap-1.5">
                {SUGGESTED.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setQuestionInput(prompt)}
                    className="rounded-lg border border-line bg-bg/50 px-3 py-1.5 text-left text-xs text-ink-soft transition hover:border-primary hover:text-primary"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            questions.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="ml-8 rounded-lg bg-ink px-3 py-2 text-sm text-white">{item.question}</div>
                <div className="mr-4 whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-sm text-ink">
                  {item.response}
                </div>
                <p className="text-right text-[11px] text-ink-soft">
                  {format(new Date(item.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                </p>
              </div>
            ))
          )}
          {pending ? <p className="text-sm text-ink-soft">Pensando…</p> : null}
        </div>
        {error ? <p className="px-4 pb-2 text-sm text-danger">{error}</p> : null}
        <div className="flex items-center gap-2 border-t border-line p-3">
          <input
            value={questionInput}
            onChange={(event) => setQuestionInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') ask();
            }}
            placeholder="Pregunta algo…"
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => ask()}
            disabled={pending || questionInput.trim() === ''}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-dark disabled:opacity-50"
            aria-label="Enviar pregunta"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
