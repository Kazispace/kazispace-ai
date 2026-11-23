'use client';

import { SerialStorylineScreen } from '@/components/radio/serial-storyline';

/** KAZI-1455: a serial story line and its episodes. */
export default function RadioStorylinePage({ params }: { params: { locale: string; storylineId: string } }) {
  return <SerialStorylineScreen locale={params.locale} storylineId={decodeURIComponent(params.storylineId)} />;
}
