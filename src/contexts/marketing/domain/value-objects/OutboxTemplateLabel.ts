const LABELS: Record<string, string> = {
  sesion_agendada: 'Sesión agendada',
  sesion_reagendada: 'Sesión reagendada',
  sesion_cancelada: 'Sesión cancelada',
  recordatorio_sesion: 'Recordatorio de sesión',
  recordatorio_pago: 'Recordatorio de pago',
  cumpleanios: 'Felicitación de cumpleaños',
  reactivacion: 'Reactivación',
  correo_masivo: 'Correo masivo',
  // La clave interna 'factura' se conserva; el nombre visible es "Recibo" (v3-spec §7).
  factura: 'Recibo',
  liga_gestion: 'Liga de gestión de la sesión',
  consentimiento: 'Consentimiento informado',
  recuperar_contrasena: 'Recuperar contraseña',
};

export function outboxTemplateLabel(template: string): string {
  return LABELS[template] ?? template;
}
