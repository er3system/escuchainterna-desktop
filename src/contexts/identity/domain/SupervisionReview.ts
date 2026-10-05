/**
 * Retroalimentación ACADÉMICA del supervisor sobre una nota de sesión del
 * supervisado (v3.2). No es contenido clínico del expediente del estudiante:
 * vive en su propia tabla (`supervision_session_reviews`, UNIQUE por
 * nota+supervisor) y el comentario se cifra at-rest en la persistencia.
 * En el dominio el comentario viaja SIEMPRE en claro.
 */
export interface SupervisionReviewPrimitives {
  id: string;
  sessionNoteId: string;
  supervisorUserId: string;
  supervisedUserId: string;
  /** Comentario en claro ('' = sin retroalimentación escrita). */
  comment: string;
  reviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Review con el nombre visible del autor (vista del estudiante). */
export interface SupervisionReviewWithAuthor extends SupervisionReviewPrimitives {
  supervisorName: string;
}
