'use client';

import { StoryPlayerScreen } from '@/components/radio/story-player';

/** KAZI-1209: a story in the player. `?from=studio` when opened from Studio's continue card. */
export default function RadioStoryPage({
  params,
  searchParams,
}: {
  params: { locale: string; saveId: string };
  searchParams?: { from?: string };
}) {
  const from = searchParams?.from === 'studio' ? 'studio' : 'home';
  return <StoryPlayerScreen locale={params.locale} saveId={decodeURIComponent(params.saveId)} from={from} />;
}
