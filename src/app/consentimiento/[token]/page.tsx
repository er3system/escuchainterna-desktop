import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Ban, CheckCircle2, FileSignature } from 'lucide-react';
import { GetConsentByToken } from '@/contexts/clinical-records/application/get-consent-by-token/GetConsentByToken';
import { SqliteConsentByToken } from '@/contexts/clinical-records/infrastructure/persistence/SqliteConsentByToken';
import { resolveConsentVariables } from '@/contexts/clinical-records/domain/value-objects/defaultConsentBody';
import { FirmarConsentimiento } from './FirmarConsentimiento';

function formatDay(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Página PÚBLICA de firma del consentimiento informado (v3 §2 paso 2):
 * el paciente abre la liga del mensaje, lee el documento con las variables
 * resueltas y firma escribiendo su nombre completo + casilla de aceptación.
 */
export default async function ConsentimientoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const consent = await new GetConsentByToken(new SqliteConsentByToken()).execute(token);
  if (!consent) notFound();

  if (consent.status === 'revocado') {
    return (
      <div className="rounded-card border border-line bg-surface p-8 text-center shadow-card">
        <Ban size={40} className="mx-auto text-ink-soft" />
        <h1 className="mt-3 text-lg font-bold text-ink">Esta liga ya no está activa</h1>
        <p className="mt-1 text-sm text-ink-soft">
          La liga de firma fue desactivada por tu profesional. Pídele que te envíe una nueva para
          firmar tu consentimiento.
        </p>
      </div>
    );
  }

  const granted = consent.status === 'firmado' || consent.status === 'papel_adjunto';
  const signDate = consent.signedAt ? formatDay(consent.signedAt) : null;
  const body = resolveConsentVariables(consent.templateBody, {
    fecha: signDate ?? formatDay(new Date()),
  });

  // Consentimiento de un MENOR (lo firma el representante legal): el snapshot
  // congelado lleva el aviso al frente (composeConsentSnapshot). Se detecta por ese
  // marcador para etiquetar la firma como del representante, sin un lookup del paciente
  // (la página pública solo conoce el token).
  const isMinorConsent = consent.templateBody.includes('AVISO PARA PACIENTE MENOR DE EDAD');

  return (
    <div>
      <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-primary">
        <FileSignature size={15} /> Consentimiento informado
      </p>
      <h1 className="mt-1 text-center text-2xl font-bold text-ink">{consent.templateTitle}</h1>
      <div className="mx-auto mt-2 mb-6 h-1 w-16 rounded-full bg-primary" />

      {granted ? (
        <div className="mb-5 rounded-card border border-line bg-success-soft p-5 text-center">
          <CheckCircle2 size={36} className="mx-auto text-success" />
          <p className="mt-2 font-bold text-ink">
            {consent.status === 'firmado'
              ? `Este consentimiento ya fue firmado${consent.signedName ? ` por ${consent.signedName}` : ''}${signDate ? ` el ${signDate}` : ''}.`
              : 'Este consentimiento ya quedó registrado con tu firma en papel.'}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            No necesitas hacer nada más. Abajo puedes releer el documento cuando quieras.
          </p>
        </div>
      ) : null}

      <article className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
        <div className="max-h-[55vh] overflow-y-auto pr-1 sm:max-h-none sm:overflow-visible">
          <div className="whitespace-pre-wrap text-justify text-sm leading-relaxed text-ink">
            {body}
          </div>
        </div>
      </article>

      {!granted ? (
        <div className="mt-5">
          <FirmarConsentimiento token={consent.token} minor={isMinorConsent} />
        </div>
      ) : null}
    </div>
  );
}
