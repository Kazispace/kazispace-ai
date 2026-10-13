'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { useEnglishAbility } from '@/hooks/use-english-ability';
import { dimensionLabel } from '@/lib/english-tutor/dimension-label';
import {
  formatAbilityScore,
  formatSignedDelta,
  latestGradingMessageId,
  latestPoint,
  showsWindow,
  sparklinePath,
  trendLabel,
} from '@/lib/english-tutor/ability-view';
import { useAuthStore, useSpaceStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type {
  EnglishAbility,
  EnglishAbilityModality,
  EnglishAbilityModalityId,
} from '@/types/english-ability';

const MODALITY_ORDER: EnglishAbilityModalityId[] = ['writing', 'speaking'];

interface IeltsPrepAbilityPanelProps {
  spaceId: string;
  className?: string;
}

/**
 * KAZI-1069 — ET ability panel (Capability §5.5.5): passive, opened by the user,
 * never auto-opened after grading, never written into the chat.
 */
export function IeltsPrepAbilityPanel({ spaceId, className }: IeltsPrepAbilityPanelProps) {
  const t = useTranslations('english.ability');
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const refreshKey = useSpaceStore((s) =>
    latestGradingMessageId(s.getSpaceSlice(spaceId).messages)
  );
  const { state, refetch } = useEnglishAbility({ enabled: isLoggedIn, refreshKey });

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-y-auto bg-white', className)}>
      <div className="shrink-0 border-b border-gray-200/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-kazi-navy">{t('title')}</h2>
        <p className="text-xs text-gray-500">{t('hint')}</p>
      </div>

      {state.kind === 'loading' ? (
        <div className="space-y-3 p-4" aria-busy="true">
          <div className="h-10 animate-pulse rounded bg-gray-100" />
          <div className="h-24 animate-pulse rounded bg-gray-100" />
        </div>
      ) : null}

      {state.kind === 'unavailable' ? (
        <p className="p-6 text-center text-sm text-gray-500">{t('unavailable')}</p>
      ) : null}

      {state.kind === 'error' ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-red-600">{t('error')}</p>
          <Button size="sm" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' ? <AbilityBody ability={state.ability} /> : null}
    </div>
  );
}

function AbilityBody({ ability }: { ability: EnglishAbility }) {
  const t = useTranslations('english.ability');
  const hasAny = MODALITY_ORDER.some((m) => ability.modalities[m]);

  if (ability.overall == null && !hasAny) {
    // Cold start (AC-P3): copy only — ⛔ no placement-test entry.
    return <p className="p-6 text-center text-sm text-gray-600">{t('empty')}</p>;
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
    </div>
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
