'use client';

import { LiveScreen } from '@/components/radio/live-screen';

/** KAZI-1287: the Live Room screen (kazispace-ui live-room.md, The Live screen). */
export default function RadioLivePage({ params }: { params: { locale: string } }) {
  return <LiveScreen locale={params.locale} />;
}
