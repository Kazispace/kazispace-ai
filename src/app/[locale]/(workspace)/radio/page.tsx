'use client';

import { RadioHomeScreen } from '@/components/radio/radio-home';

/** KAZI-1209: the personal radio's home (kazispace-ui personal-radio.md, Radio home). */
export default function RadioPage({ params }: { params: { locale: string } }) {
  return <RadioHomeScreen locale={params.locale} />;
}
