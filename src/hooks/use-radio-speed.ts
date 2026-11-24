'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PlayerSpeed } from '@/hooks/use-sentence-player';
import { patchRadioPrefs } from '@/lib/radio/api';
import { levelSpeed, startSpeed, writeDefaultSpeed } from '@/lib/radio/settings';
import type { RadioHome } from '@/types/radio';

/**
 * The speed slider's position for a player (Player · Speed).
 *
 * It starts at the position saved on the account (`GET home` `prefs.speed`), else the copy on this device, else
 * the position for the listener's level. Once the listener moves it in this player, a level or a home answer
 * arriving later does not move it back.
 *
 * - `level` is the position for the listener's level, marked on the slider.
 * - `slide` follows the thumb (and a spoken "slower" / "normal speed"): this listen only, nothing saved.
 * - `save` is called when the listener lets go: the position is kept on this device and sent to the account
 *   (`PATCH prefs`). A failed send is not shown: the device copy still holds the position.
 */
export function useRadioSpeed({
  band,
  home,
  setHome,
}: {
  band: string | null | undefined;
  home: RadioHome | null;
  setHome: (home: RadioHome) => void;
}) {
  const [speed, setSpeed] = useState<PlayerSpeed>(1);
  const touched = useRef(false);
  const homeRef = useRef(home);
  homeRef.current = home;
  const account = home?.prefs?.speed ?? null;
  useEffect(() => {
    if (!touched.current) setSpeed(startSpeed(band, account));
  }, [band, account]);
  const slide = useCallback((to: PlayerSpeed) => {
    touched.current = true;
    setSpeed(to);
  }, []);
  const save = useCallback(
    (to: PlayerSpeed) => {
      writeDefaultSpeed(to);
      void patchRadioPrefs({ speed: to })
        .then((res) => {
          const h = homeRef.current;
          if (res.success && res.data && h) setHome({ ...h, prefs: res.data.prefs ?? {}, profile: res.data.profile });
        })
        .catch(() => undefined);
    },
    [setHome]
  );
  return { speed, slide, save, level: levelSpeed(band) };
}
