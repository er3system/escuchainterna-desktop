import { notFound } from 'next/navigation';
import { requireSessionUserId } from '@/shared/infrastructure/auth/session';
import { findTutorial } from '../tutorials';
import { TutorialPlayer } from '../TutorialPlayer';
import { isDesktopEdition } from '@/shared/infrastructure/config/desktopEdition';

export default async function TutorialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSessionUserId();
  const { id } = await params;
  if (!findTutorial(id)) notFound();

  return (
    <div className="py-2">
      <TutorialPlayer tutorialId={id} desktopEdition={isDesktopEdition()} />
    </div>
  );
}
