/**
 * Radio's own dark look (KAZI-1512; kazispace-ui D48, Personal radio 0.35 "Look"). Owen, 2026-11-28, quoted as
 * written: 「个人电台的UI设计。 是下一个重点任务。 请参照参考视频的设计，非常有吸引力。 看看能否借鉴」; he chose "Radio always
 * dark (Recommended)" and "Keep tap, new look (Recommended)".
 *
 * Every Radio screen uses these, whatever the system appearance; the tab bar, the rail and every other
 * destination keep the app's usual look. Colours come only from the `radio.*` Tailwind colours (tokens 0.4).
 */

/** The page: a vertical gradient, fixed behind the content, with the primary text colour. */
export const RADIO_PAGE = 'bg-gradient-to-b from-radio-bg-top to-radio-bg-bottom bg-fixed text-radio-text';

/**
 * The one accent (the microphone button and a screen's primary action): the gradient, `on-accent` text, and a
 * 2px `accent-ring` so the control's edge reaches 3:1 against the page (the gradient alone is about 2.6:1).
 */
export const RADIO_ACCENT = 'bg-gradient-to-r from-radio-accent-start to-radio-accent-end text-radio-on-accent ring-2 ring-radio-ring';

/** A card: `surface`, radius lg, no shadow. */
export const RADIO_CARD = 'rounded-xl bg-radio-surface';
