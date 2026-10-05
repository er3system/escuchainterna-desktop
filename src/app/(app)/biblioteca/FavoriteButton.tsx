'use client';

import { useOptimistic, useTransition } from 'react';
import { Heart } from 'lucide-react';
import { togglePublicationFavoriteAction } from './actions';

export function FavoriteButton({ publicationId, favorite }: { publicationId: string; favorite: boolean }) {
  const [, startTransition] = useTransition();
  const [optimisticFavorite, setOptimisticFavorite] = useOptimistic(favorite);

  function handleToggle() {
    startTransition(async () => {
      setOptimisticFavorite(!optimisticFavorite);
      await togglePublicationFavoriteAction(publicationId);
    });
  }

  const label = optimisticFavorite ? 'Quitar de favoritos' : 'Marcar como favorito';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
      aria-pressed={optimisticFavorite}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
        optimisticFavorite
          ? 'border-danger-soft bg-danger-soft text-danger'
          : 'border-line bg-surface text-ink-soft hover:border-danger-soft hover:text-danger'
      }`}
    >
      <Heart size={16} fill={optimisticFavorite ? 'currentColor' : 'none'} />
    </button>
  );
}
