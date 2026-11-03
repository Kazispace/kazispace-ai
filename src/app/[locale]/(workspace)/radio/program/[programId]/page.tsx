'use client';

import { ProgramPlayerScreen } from '@/components/radio/program-player';

/** KAZI-1209: a program in the player. */
export default function RadioProgramPage({ params }: { params: { locale: string; programId: string } }) {
  return <ProgramPlayerScreen locale={params.locale} programId={decodeURIComponent(params.programId)} />;
}
