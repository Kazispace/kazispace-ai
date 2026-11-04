'use client';

import { RadioSettingsScreen } from '@/components/radio/radio-settings';

/**
 * KAZI-1209: radio settings. `?save=<id>` when opened from the player (Back returns to it), plus
 * `from=studio` when that player was opened from Studio's continue card.
 */
export default function RadioSettingsPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { save?: string; from?: string };
}) {
  return (
    <RadioSettingsScreen
      locale={params.locale}
      saveId={searchParams?.save ?? null}
      from={searchParams?.from === 'studio' ? 'studio' : 'home'}
    />
  );
}
