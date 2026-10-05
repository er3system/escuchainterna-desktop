/** Aviso al supervisado cuando su supervisor deja retroalimentación o revisa una nota. */
export interface SupervisionReviewNotice {
  supervisedUserId: string;
  supervisorUserId: string;
  patientId: string;
  sessionNoteId: string;
  noteTitle: string;
  /** Qué cambió: comentario nuevo/actualizado o marca de "revisada". */
  change: 'comentario' | 'revisada';
}

export interface SupervisionReviewNotifier {
  notifyReviewSaved(notice: SupervisionReviewNotice): Promise<void>;
}
