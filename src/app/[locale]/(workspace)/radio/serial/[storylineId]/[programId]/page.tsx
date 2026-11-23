'use client';

import { ProgramPlayerScreen } from '@/components/radio/program-player';

/** KAZI-1455: an episode of a serial story in the player. Keyed by episode: the next episode starts afresh. */
export default function RadioEpisodePage({
  params,
}: {
  params: { locale: string; storylineId: string; programId: string };
}) {
  const programId = decodeURIComponent(params.programId);
  return (
    <ProgramPlayerScreen
      key={programId}
      locale={params.locale}
      programId={programId}
      serial={{ storylineId: decodeURIComponent(params.storylineId) }}
    />
  );
}
