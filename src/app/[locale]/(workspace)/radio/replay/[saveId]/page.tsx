'use client';

import { RadioReplayScreen } from '@/components/radio/radio-replay';

/** KAZI-1209: the replay of a story, every step as it was heard. */
export default function RadioReplayPage({ params }: { params: { locale: string; saveId: string } }) {
  return <RadioReplayScreen locale={params.locale} saveId={decodeURIComponent(params.saveId)} />;
}
