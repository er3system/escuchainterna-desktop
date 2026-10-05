import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Clock, Download, List, ScrollText } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { ReadPublication } from '@/contexts/library/application/read-publication/ReadPublication';
import type { ReadPublicationResult } from '@/contexts/library/application/read-publication/ReadPublication';
import { ReadPublicationMessage } from '@/contexts/library/application/read-publication/ReadPublicationMessage';
import { HtmlPublicationContentReader } from '@/contexts/library/infrastructure/filesystem/HtmlPublicationContentReader';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';
import type { PublicationHeading } from '@/contexts/library/domain/PublicationContent';
import { DomainError } from '@/shared/domain/DomainError';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { markPublicationReviewedAction } from '../actions';
import { FavoriteButton } from '../FavoriteButton';
import { FontSizeControls } from './FontSizeControls';
import { ReadingProgress } from './ReadingProgress';
import { lectorCss } from './lectorCss';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const publication = await new SqlitePublicationRepository().findById(id);
  if (!publication) return { title: 'Biblioteca — EscuchaInterna' };
  return { title: `${publication.toPrimitives().title} — Biblioteca — EscuchaInterna` };
}

export default async function LectorPublicacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Solo el admin de plataforma puede otorgar el sello de revisión (v3 §8).
  const userId = await requireActiveAppSessionUserId();
  const isAdmin = (await createIdentityUseCases().getSessionContext.get(userId))?.role === 'admin';

  let result: ReadPublicationResult;
  try {
    result = await new ReadPublication(
      new SqlitePublicationRepository(userId),
      new HtmlPublicationContentReader(),
    ).read(new ReadPublicationMessage({ publicationId: id }));
  } catch (error) {
    // Solo los errores de dominio (id inválido, publicación inexistente) son 404.
    if (error instanceof DomainError) notFound();
    throw error;
  }

  const { publication, content } = result;
  const sourcesCount = publication.sources.length;
  const readingMinutes = content ? estimateReadingMinutes(content.html) : null;

  return (
    <div className="mx-auto max-w-[72rem]">
      <ReadingProgress />

      {/* ---- Cabecera compacta del lector ---- */}
      <header className="mb-6 rounded-card border border-line bg-surface px-5 py-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/biblioteca"
            className="flex items-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft size={15} />
            Biblioteca
          </Link>
          <div className="flex items-center gap-2">
            {publication.pdfPath ? (
              <a
                href={`/api/biblioteca/${publication.id}/pdf`}
                download
                className="flex items-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
              >
                <Download size={15} />
                Descargar PDF
              </a>
            ) : null}
            <FontSizeControls />
            <FavoriteButton publicationId={publication.id} favorite={publication.favorite} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{publication.category}</Badge>
          {publication.country ? <Badge tone="neutral">{publication.country}</Badge> : null}
          {publication.reviewed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
              <BadgeCheck size={13} className="shrink-0" />
              Revisada por el equipo clínico de EscuchaInterna
            </span>
          ) : isAdmin ? (
            <form action={markPublicationReviewedAction.bind(null, publication.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-bg px-2.5 py-0.5 text-xs font-medium text-ink-soft transition-colors hover:border-success hover:text-success"
              >
                <BadgeCheck size={13} />
                Marcar como revisada
              </button>
            </form>
          ) : null}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-ink">{publication.title}</h1>
        {publication.summary ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-soft">{publication.summary}</p>
        ) : null}
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          {readingMinutes !== null ? (
            <span className="flex items-center gap-1">
              <Clock size={12} />~{readingMinutes} min de lectura
            </span>
          ) : null}
          <span className="flex items-center gap-1">
            <ScrollText size={12} />
            {sourcesCount} {sourcesCount === 1 ? 'fuente citada' : 'fuentes citadas'}
          </span>
        </p>
      </header>

      {content ? (
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-10">
          {/* ---- Índice pegajoso (desktop) ---- */}
          {content.headings.length > 0 ? (
            <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-card lg:block">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <List size={13} className="text-primary" />
                Contenido
              </p>
              <TocLinks headings={content.headings} />
            </aside>
          ) : (
            <div className="hidden lg:block" />
          )}

          <div className="min-w-0">
            {/* ---- Índice colapsable (móvil) ---- */}
            {content.headings.length > 0 ? (
              <details className="mb-5 rounded-card border border-line bg-surface shadow-card lg:hidden">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                  <List size={15} className="text-primary" />
                  Índice de contenidos
                </summary>
                <div className="border-t border-line px-3 pb-3 pt-2">
                  <TocLinks headings={content.headings} />
                </div>
              </details>
            ) : null}

            {/* ---- Columna de lectura ---- */}
            <article
              lang="es"
              className="lector mx-auto w-full max-w-[46rem] pb-16"
              dangerouslySetInnerHTML={{ __html: content.html }}
            />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Contenido aún no disponible"
          description="El cuerpo de esta publicación todavía no está en la plataforma. Vuelve a intentarlo más tarde o recarga el catálogo desde la biblioteca."
          action={
            <Link
              href="/biblioteca"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
            >
              Volver a la biblioteca
            </Link>
          }
        />
      )}

      <style>{lectorCss}</style>
    </div>
  );
}

function TocLinks({ headings }: { headings: PublicationHeading[] }) {
  return (
    <ol>
      {headings.map((heading) => (
        <li key={heading.id}>
          <a
            href={`#${heading.id}`}
            className={`block rounded-md px-2 py-1 text-[13px] leading-snug text-ink-soft transition-colors hover:bg-primary-light hover:text-primary ${
              heading.level === 2 ? 'ml-2.5 border-l-2 border-line pl-3' : 'font-medium'
            }`}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );
}

/** Estimación de lectura sobre el texto plano del contenido (~220 palabras/min). */
function estimateReadingMinutes(html: string): number {
  const words = html
    .replace(/<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
