'use client';

import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useEnglishAbility } from '@/hooks/use-english-ability';
import { dimensionLabel } from '@/lib/english-tutor/dimension-label';
import {
  formatAbilityScore,
  formatSignedDelta,
  latestGradingMessageId,
  latestPoint,
  localizedText,
  masteryPercent,
  showsWindow,
  sparklinePath,
  trendLabel,
} from '@/lib/english-tutor/ability-view';
import { useSpaceStore } from '@/lib/store';
import type {
  EnglishAbility,
  EnglishAbilityModality,
  EnglishAbilityModalityId,
  EnglishAbilityWeakTag,
} from '@/types/english-ability';

const MODALITY_ORDER: EnglishAbilityModalityId[] = ['writing', 'speaking'];

interface EnglishAbilitySectionProps {
  /**
   * The English Space whose chat 「练这个」 sends into. Absent in Studio (KAZI-1171): the
   * section is read-only there — no practice buttons, no refresh on a Space's grading.
   */
  spaceId?: string;
}

/**
 * KAZI-1069 — ET ability block, the top section of the IELTS「英语练习」panel
 * (Owen 2026-10-13: one tab with EPP, not a separate「能力」tab). Capability §5.5.5:
 * passive — it mounts only when the user opens the panel, never auto-opens after
 * grading, never writes into the chat. Gate off / no route ⇒ renders nothing.
 */
export function EnglishAbilitySection({ spaceId }: EnglishAbilitySectionProps) {
  const t = useTranslations('english.ability');
  const tStates = useTranslations('states');
  const refreshKey = useSpaceStore((s) =>
    spaceId ? latestGradingMessageId(s.getSpaceSlice(spaceId).messages) : null
  );
  const { state, refetch } = useEnglishAbility({ enabled: true, refreshKey });

  // Nothing until we know: where the backend gate is off the 503 would otherwise flash a
  // skeleton and then collapse, shifting EPP up (#232 review ⚪ · Owen 2026-10-13「remove it」).
  if (state.kind === 'unavailable' || state.kind === 'loading') return null;

  return (
    <section
      aria-labelledby="english-ability-heading"
      className="shrink-0 border-b border-gray-200/80"
    >
      <div className="px-4 pt-3">
        <h3 id="english-ability-heading" className="text-sm font-semibold text-kazi-navy">
          {t('title')}
        </h3>
        <p className="text-xs text-gray-500">{t('hint')}</p>
      </div>

      {state.kind === 'error' ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-red-600">{t('error')}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            {tStates('retry')}
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' ? <AbilityBody ability={state.ability} spaceId={spaceId} /> : null}
    </section>
  );
}

function AbilityBody({ ability, spaceId }: { ability: EnglishAbility; spaceId?: string }) {
  const t = useTranslations('english.ability');
  const hasAny = MODALITY_ORDER.some((m) => ability.modalities[m]);
  // KAZI-1083: mastery comes from practice evidence, not scores — a grammar-only learner has
  // weak tags and no score yet, so the block shows in the score cold start too.
  const weak = <WeakTags weak={ability.weak_tags} spaceId={spaceId} />;

  if (ability.overall == null && !hasAny) {
    // Cold start (AC-P3): copy only — ⛔ no placement-test entry.
    return (
      <>
        <p className="px-4 py-4 text-sm text-gray-600">{t('empty')}</p>
        {ability.weak_tags ? <div className="px-4 pb-4">{weak}</div> : null}
      </>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-gray-600">{t('overall')}</span>
        <span className="text-2xl font-semibold tabular-nums text-kazi-navy">
          {formatAbilityScore(ability.overall)}
          <span className="ml-1 text-xs font-normal text-gray-500">{t('outOf')}</span>
        </span>
      </div>
      {MODALITY_ORDER.map((m) => (
        <ModalityCard key={m} id={m} modality={ability.modalities[m] ?? null} />
      ))}
      {weak}
    </div>
  );
}

/**
 * KAZI-1083 — the weakest three (Capability §5.5.5 / §5.5.6 v1.0.24). `null` ⇒ nothing (switch
 * off / readings incomplete); `[]` ⇒ one hint line. 「练这个」 hands the backend's own
 * `et_next_practice` action to this space's chat — the same send as the graded-turn button
 * (ET SSOT v1.98 ①); the panel never sends on its own.
 */
function WeakTags({
  weak,
  spaceId,
}: {
  weak: EnglishAbilityWeakTag[] | null | undefined;
  spaceId?: string;
}) {
  const t = useTranslations('english.ability.weak');
  const locale = useLocale();
  const tArea = useTranslations('english.ability.area');
  const isSending = useSpaceStore((s) => (spaceId ? s.getSpaceSlice(spaceId).isSending : false));
  const requestSpaceAction = useSpaceStore((s) => s.requestSpaceAction);

  if (!weak) return null;

  return (
    <section aria-labelledby="english-weak-heading" className="space-y-2">
      <div>
        <h3 id="english-weak-heading" className="text-sm font-medium text-gray-800">
          {t('title')}
        </h3>
        <p className="text-xs text-gray-500">{t('hint')}</p>
      </div>
      {weak.length === 0 ? (
        <p className="text-xs text-gray-500">{t('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {weak.map((w) => {
            const name = localizedText(w.label, locale) || w.tag;
            const percent = masteryPercent(w.p_mastery);
            const area = tArea.has(w.skill_area) ? tArea(w.skill_area) : null;
            return (
              <li key={w.tag} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{name}</p>
                    <p className="text-xs text-gray-500">
                      {area ? `${area} · ` : ''}
                      {t('evidence', { count: w.obs_count })}
                    </p>
                  </div>
                  {spaceId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={isSending}
                      aria-label={t('practiceAria', { name })}
                      onClick={() => requestSpaceAction(spaceId, w.action)}
                    >
                      {t('practice')}
                    </Button>
                  ) : null}
                </div>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  aria-label={t('mastery', { percent })}
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                >
                  <div className="h-full rounded-full bg-kazi-navy" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs tabular-nums text-gray-500">{t('mastery', { percent })}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ModalityCard({
  id,
  modality,
}: {
  id: EnglishAbilityModalityId;
  modality: EnglishAbilityModality | null;
}) {
  const t = useTranslations('english.ability');
  const tEnvelope = useTranslations('english.envelope');
  const name = t(`modality.${id}`);

  if (!modality) {
    return (
      <section className="rounded-lg border border-gray-200 p-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-gray-800">{name}</h3>
          <span className="text-sm text-gray-400">—</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('modalityEmpty')}</p>
      </section>
    );
  }

  const trend = trendLabel(tEnvelope, modality.trend);
  const latest = latestPoint(modality);

  return (
    <section className="space-y-2 rounded-lg border border-gray-200 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-800">{name}</h3>
        <span className="text-lg font-semibold tabular-nums text-gray-900">
          {formatAbilityScore(modality.current)}
        </span>
      </div>

      <dl className="space-y-1 text-xs text-gray-600">
        {trend ? (
          <div className="flex justify-between gap-2">
            <dt>{tEnvelope('progressTrend')}</dt>
            <dd className="font-medium text-gray-800">{trend}</dd>
          </div>
        ) : null}
        {showsWindow(modality) ? (
          <div className="flex justify-between gap-2">
            <dt>{tEnvelope('progressWindow', { count: modality.window.n })}</dt>
            <dd className="font-medium tabular-nums text-gray-800">
              {tEnvelope('progressWindowRange', {
                from: formatAbilityScore(modality.window.from),
                to: formatAbilityScore(modality.window.to),
                delta: formatSignedDelta(modality.window.delta),
              })}
            </dd>
          </div>
        ) : null}
        {latest ? (
          <div className="flex justify-between gap-2">
            <dt>{t('latest')}</dt>
            <dd className="font-medium tabular-nums text-gray-800">
              {formatAbilityScore(latest.score)}
            </dd>
          </div>
        ) : null}
      </dl>

      {modality.dimensions.length > 0 ? (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {modality.dimensions.map((d) => (
            <li key={d.id} className="flex justify-between gap-2">
              <span className="text-gray-600">
                {dimensionLabel(tEnvelope, { key: d.id, label: d.label })}
              </span>
              <span className="tabular-nums text-gray-800">{formatAbilityScore(d.score)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Sparkline modality={modality} label={t('trendLine', { name })} />
    </section>
  );
}

const SPARK_W = 240;
const SPARK_H = 40;

function Sparkline({ modality, label }: { modality: EnglishAbilityModality; label: string }) {
  const pts = sparklinePath(modality.points, { width: SPARK_W, height: SPARK_H });
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  return (
    <svg
      viewBox={`-6 -6 ${SPARK_W + 12} ${SPARK_H + 12}`}
      className="h-12 w-full text-kazi-navy"
      role="img"
      aria-label={label}
    >
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={8} fill="transparent">
          <title>{formatAbilityScore(p.score)}</title>
        </circle>
      ))}
      <circle cx={last.x} cy={last.y} r={4} fill="currentColor" stroke="white" strokeWidth={2} />
    </svg>
  );
}
