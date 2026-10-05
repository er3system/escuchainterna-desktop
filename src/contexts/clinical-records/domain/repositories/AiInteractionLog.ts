export type AiInteractionKind = 'pregunta' | 'reporte';

export type AiProvider = 'local' | 'anthropic';

export interface AiInteraction {
  id: string;
  sessionNoteId: string;
  kind: AiInteractionKind;
  prompt: string;
  response: string;
  provider: AiProvider;
  createdAt: string;
}

/** Bitácora de interacciones con la IA sobre una nota de sesión (tabla ai_interactions). */
export interface AiInteractionLog {
  append(interaction: AiInteraction): Promise<void>;
  listForNote(sessionNoteId: string, kind?: AiInteractionKind): Promise<AiInteraction[]>;
  latestForNote(sessionNoteId: string, kind: AiInteractionKind): Promise<AiInteraction | null>;
}
