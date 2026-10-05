import Link from 'next/link';
import {
  BadgeCheck,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardList,
  Download,
  Globe,
  Heart,
  HeartPulse,
  RefreshCw,
  Scale,
  ScrollText,
  Search,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, Card, EmptyState } from '@/components/ui';
import { createIdentityUseCases } from '@/contexts/identity/infrastructure/createIdentityUseCases';
import { LoadPublicationCatalog } from '@/contexts/library/application/load-publication-catalog/LoadPublicationCatalog';
import { SearchPublications } from '@/contexts/library/application/search-publications/SearchPublications';
import { SearchPublicationsQuery } from '@/contexts/library/application/search-publications/SearchPublicationsQuery';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';
import { publicationsManifestExists } from '@/contexts/library/infrastructure/filesystem/PublicationManifestReader';
import { PUBLICATION_CATEGORIES } from '@/contexts/library/domain/Publication';
import type { PublicationPrimitives } from '@/contexts/library/domain/Publication';
import { requireActiveAppSessionUserId } from '@/shared/infrastructure/auth/dataOwner';
import { markPublicationReviewedAction, reloadPublicationCatalogAction } from './actions';
import { FavoriteButton } from './FavoriteButton';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

const NORMATIVE_CATEGORY = 'Marcos normativos';
const formatNumber = new Intl.NumberFormat('es-MX');

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Modelos terapéuticos': Brain,
  'Temas clínicos': HeartPulse,
  'Marcos normativos': Scale,
  'Pruebas e instrumentos': ClipboardList,
};

interface Filters {
  q: string;
  categoria: string;
  pais: string;
  favoritos: boolean;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function buildUrl(filters: Partial<Filters>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.categoria) params.set('categoria', filters.categoria);
  if (filters.pais) params.set('pais', filters.pais);
  if (filters.favoritos) params.set('favoritos', '1');
  const query = params.toString();
  return query ? `/biblioteca?${query}` : '/biblioteca';
}

export default async function BibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Solo el admin de plataforma ve el botón "Marcar como revisada" (v3 §8).
  const userId = await requireActiveAppSessionUserId();
  const isAdmin = (await createIdentityUseCases().getSessionContext.get(userId))?.role === 'admin';
  const repository = new SqlitePublicationRepository(userId);
  const manifestExists = publicationsManifestExists();

  // Primera visita: si la tabla está vacía y ya hay manifest, se carga solo.
  let autoLoaded = 0;
  if ((await repository.totalPublications()) === 0 && manifestExists) {
    autoLoaded = (await new LoadPublicationCatalog(repository).load()).loaded;
  }

  const filters: Filters = {
    q: first(params.q).trim(),
    categoria: first(params.categoria).trim(),
    pais: first(params.pais).trim(),
    favoritos: first(params.favoritos) === '1',
  };

  const query = SearchPublicationsQuery.fromPrimitives({
    text: filters.q,
    category: filters.categoria,
    country: filters.pais,
    onlyFavorites: filters.favoritos,
  });
  const result = await new SearchPublications(repository).search(query);
  const totalCatalog = await repository.totalPublications();
  const favoritesCount = await repository.countFavorites();
  const categoryTotals = new Map(result.categories.map(({ category, total }) => [category, total]));
  const normativeCountries = await repository.listCountries(NORMATIVE_CATEGORY);
  const countries = filters.categoria === NORMATIVE_CATEGORY ? normativeCountries : [];

  const loadedParam = first(params.cargadas);
  const loadedNotice =
    autoLoaded > 0 ? autoLoaded : loadedParam !== '' && Number.isFinite(Number(loadedParam)) ? Number(loadedParam) : null;

  const hasActiveFilters = Boolean(filters.q || filters.categoria || filters.pais || filters.favoritos);
  const collectionEmpty = totalCatalog === 0;

  return (
    <div>
      {/* ---- Hero de la colección ---- */}
      <section className="relative mb-6 overflow-hidden rounded-card bg-gradient-to-br from-primary to-primary-dark p-8 text-white shadow-card">
        <svg
          viewBox="0 0 88 88"
          aria-hidden="true"
          className="pointer-events-none absolute -right-6 -top-10 h-56 w-56 opacity-15"
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M44 14 a30 30 0 0 1 0 60" strokeWidth="7" />
            <path d="M38 24 a20 20 0 0 1 0 40" strokeWidth="6" opacity="0.75" />
            <path d="M32 34 a10 10 0 0 1 0 20" strokeWidth="5" opacity="0.5" />
          </g>
          <circle cx="22" cy="44" r="7" fill="currentColor" />
        </svg>
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest">
              <Sparkles size={13} />
              Colección EscuchaInterna
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight">
              Colección EscuchaInterna — material original para tu práctica
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">
              Modelos terapéuticos, temas clínicos y marcos normativos por país, redactados para la
              comunidad hispanohablante y citando solo fuentes públicas verificables.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/85">
              <span className="flex items-center gap-1.5">
                <BookOpen size={15} />
                {formatNumber.format(totalCatalog)} publicaciones
              </span>
              {normativeCountries.length > 0 ? (
                <span className="flex items-center gap-1.5">
                  <Globe size={15} />
                  Marcos normativos: {formatNumber.format(normativeCountries.length)}{' '}
                  {normativeCountries.length === 1 ? 'país' : 'países'}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5">
                <Heart size={15} />
                {formatNumber.format(favoritesCount)} favoritas
              </span>
            </div>
          </div>
          <form action={reloadPublicationCatalogAction}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
            >
              <RefreshCw size={15} />
              Recargar catálogo
            </button>
          </form>
        </div>
      </section>

      {loadedNotice !== null ? (
        <div className="mb-4 flex items-center gap-2 rounded-card border border-success-soft bg-success-soft px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 size={16} />
          {loadedNotice > 0
            ? `Se añadieron ${formatNumber.format(loadedNotice)} publicaciones a la colección.`
            : 'El catálogo ya estaba al día: no hay publicaciones nuevas.'}
        </div>
      ) : null}

      {collectionEmpty ? (
        <EmptyState
          title={isDesktopEdition() ? 'No hay publicaciones instaladas' : 'La colección se está generando…'}
          description={isDesktopEdition() ? 'Las publicaciones se distribuyen por separado bajo sus propias licencias. Esta edición no descarga ni añade contenidos automáticamente.' : 'El equipo editorial de EscuchaInterna está redactando las publicaciones de la colección. En cuanto estén listas aparecerán aquí automáticamente; también puedes intentar recargar el catálogo.'}
          action={
            <form action={reloadPublicationCatalogAction}>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                <RefreshCw size={15} />
                Recargar catálogo
              </button>
            </form>
          }
        />
      ) : (
        <>
          {/* ---- Búsqueda + favoritos ---- */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <form method="get" action="/biblioteca" className="flex min-w-64 flex-1 items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.q}
                  placeholder="Buscar en la colección por título, tema o país…"
                  className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-soft focus:border-primary focus:outline-none"
                />
              </div>
              {filters.categoria ? <input type="hidden" name="categoria" value={filters.categoria} /> : null}
              {filters.pais ? <input type="hidden" name="pais" value={filters.pais} /> : null}
              {filters.favoritos ? <input type="hidden" name="favoritos" value="1" /> : null}
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
              >
                Buscar
              </button>
            </form>
            <Link
              href={buildUrl({ ...filters, favoritos: !filters.favoritos })}
              aria-pressed={filters.favoritos}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                filters.favoritos
                  ? 'border-danger-soft bg-danger-soft text-danger'
                  : 'border-line bg-surface text-ink-soft hover:text-ink'
              }`}
            >
              <Heart size={15} fill={filters.favoritos ? 'currentColor' : 'none'} />
              Solo favoritos ({formatNumber.format(favoritesCount)})
            </Link>
          </div>

          {/* ---- Tabs por categoría ---- */}
          <div className="mb-3 flex flex-wrap gap-2">
            <Link
              href={buildUrl({ q: filters.q, favoritos: filters.favoritos })}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                !filters.categoria
                  ? 'border-primary bg-primary-light text-primary'
                  : 'border-line bg-surface text-ink-soft hover:text-ink'
              }`}
            >
              Todas · {formatNumber.format(totalCatalog)}
            </Link>
            {PUBLICATION_CATEGORIES.map((category) => {
              const active = filters.categoria === category;
              const Icon = CATEGORY_ICONS[category] ?? BookOpen;
              return (
                <Link
                  key={category}
                  href={buildUrl({
                    q: filters.q,
                    favoritos: filters.favoritos,
                    categoria: active ? '' : category,
                  })}
                  className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'border-primary bg-primary-light text-primary'
                      : 'border-line bg-surface text-ink-soft hover:text-ink'
                  }`}
                >
                  <Icon size={13} />
                  {category} · {formatNumber.format(categoryTotals.get(category) ?? 0)}
                </Link>
              );
            })}
          </div>

          {/* ---- Sub-filtro por país (solo Marcos normativos) ---- */}
          {countries.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-4 py-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <Globe size={13} />
                País
              </span>
              <Link
                href={buildUrl({ ...filters, pais: '' })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  !filters.pais
                    ? 'border-primary bg-primary-light text-primary'
                    : 'border-line bg-bg text-ink-soft hover:text-ink'
                }`}
              >
                Todos
              </Link>
              {countries.map(({ country, total }) => {
                const active = filters.pais === country;
                return (
                  <Link
                    key={country}
                    href={buildUrl({ ...filters, pais: active ? '' : country })}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-primary bg-primary-light text-primary'
                        : 'border-line bg-bg text-ink-soft hover:text-ink'
                    }`}
                  >
                    {country} · {formatNumber.format(total)}
                  </Link>
                );
              })}
            </div>
          ) : null}

          {/* ---- Resultados ---- */}
          {result.publications.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="No encontramos publicaciones para tu búsqueda. Prueba con otros términos o quita los filtros."
              action={
                hasActiveFilters ? (
                  <Link
                    href="/biblioteca"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark"
                  >
                    Limpiar filtros
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-soft">
                {formatNumber.format(result.total)}{' '}
                {result.total === 1 ? 'publicación' : 'publicaciones'}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.publications.map((publication) => (
                  <PublicationCard key={publication.id} publication={publication} isAdmin={isAdmin} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function PublicationCard({
  publication,
  isAdmin,
}: {
  publication: PublicationPrimitives;
  isAdmin: boolean;
}) {
  const Icon = CATEGORY_ICONS[publication.category] ?? BookOpen;
  const sourcesCount = publication.sources.length;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          <Icon size={18} />
        </span>
        <FavoriteButton publicationId={publication.id} favorite={publication.favorite} />
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="primary">{publication.category}</Badge>
          {publication.country ? <Badge tone="neutral">{publication.country}</Badge> : null}
        </div>
        <h2 className="mt-2 line-clamp-2 text-base font-semibold text-ink" title={publication.title}>
          <Link href={`/biblioteca/${publication.id}`} className="transition-colors hover:text-primary">
            {publication.title}
          </Link>
        </h2>
        <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-ink-soft">{publication.summary}</p>
        {publication.reviewed ? (
          <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-success">
            <BadgeCheck size={14} className="shrink-0" />
            Revisada por el equipo clínico de EscuchaInterna
          </p>
        ) : isAdmin ? (
          <form action={markPublicationReviewedAction.bind(null, publication.id)} className="mt-2.5">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-success hover:text-success"
            >
              <BadgeCheck size={14} />
              Marcar como revisada
            </button>
          </form>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-xs text-ink-soft">
          <ScrollText size={13} />
          {sourcesCount} {sourcesCount === 1 ? 'fuente' : 'fuentes'}
        </span>
        <div className="flex items-center gap-1.5">
          {publication.pdfPath ? (
            <a
              href={`/api/biblioteca/${publication.id}/pdf`}
              download
              aria-label="Descargar PDF"
              title="Descargar PDF"
              className="flex items-center justify-center rounded-lg border border-line bg-bg p-1.5 text-ink-soft transition-colors hover:border-primary hover:text-primary"
            >
              <Download size={14} />
            </a>
          ) : null}
          <Link
            href={`/biblioteca/${publication.id}`}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-dark"
          >
            <BookOpen size={13} />
            Leer
          </Link>
        </div>
      </div>
    </Card>
  );
}
