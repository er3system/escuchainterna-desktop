import Link from 'next/link';
import { SqlitePublicationRepository } from '@/contexts/library/infrastructure/persistence/SqlitePublicationRepository';
import { PageHeader } from '@/components/ui';
import { requireAdmin } from '../requireAdmin';
import { ModerationTable, type ModerationRow } from './ModerationTable';

export const metadata = { title: 'Biblioteca · Administración · EscuchaInterna' };

type Estado = 'pendientes' | 'revisadas' | 'todas';

export default async function AdminBibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  await requireAdmin();
  const { estado } = await searchParams;
  const current: Estado = estado === 'revisadas' ? 'revisadas' : estado === 'todas' ? 'todas' : 'pendientes';

  const repo = new SqlitePublicationRepository();
  const pendientes = await repo.countMatching({ reviewed: false });
  const revisadas = await repo.countMatching({ reviewed: true });
  const total = await repo.totalPublications();

  const criteria = current === 'revisadas' ? { reviewed: true } : current === 'todas' ? {} : { reviewed: false };
  const publications: ModerationRow[] = (await repo.search(criteria)).map((publication) => {
    const p = publication.toPrimitives();
    return { id: p.id, title: p.title, category: p.category, country: p.country, reviewed: p.reviewed };
  });

  const tabs: { key: Estado; label: string; count: number }[] = [
    { key: 'pendientes', label: 'Por revisar', count: pendientes },
    { key: 'revisadas', label: 'Revisadas', count: revisadas },
    { key: 'todas', label: 'Todas', count: total },
  ];

  return (
    <div>
      <PageHeader
        title="Biblioteca"
        subtitle="Modera la Colección EscuchaInterna: otorga o retira el sello «Revisada por el equipo clínico»"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={`/admin/biblioteca?estado=${tab.key}`}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-primary text-white'
                  : 'border border-line text-ink-soft hover:border-primary hover:text-primary'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? 'bg-white/20' : 'bg-bg text-ink-soft'
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <ModerationTable publications={publications} />
    </div>
  );
}
