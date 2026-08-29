'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  EnglishTutorEnvelopeComponent,
  EssayDiffComponent,
  EssaySpanIssue,
  ExamPickerOption,
  ScoreDimension,
} from '@/types/english-tutor-envelope';

interface EnglishTutorEnvelopeBlocksProps {
  components: EnglishTutorEnvelopeComponent[];
  locale: string;
  lowConfidence?: boolean;
  onFocusComposer?: () => void;
  onExamSelect?: (option: ExamPickerOption) => void;
  className?: string;
}

function AiSyntheticDisclaimer() {
  const t = useTranslations('english.envelope');
  return (
    <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] leading-snug text-amber-900">
      {t('aiSyntheticDisclaimer')}
    </p>
  );
}

function LowConfidenceBanner() {
  const t = useTranslations('english.envelope');
  return (
    <p className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-orange-900">
      {t('lowConfidenceBanner')}
    </p>
  );
}

function ReviseCtaButton({ onClick }: { onClick?: () => void }) {
  const t = useTranslations('english.envelope');
  if (!onClick) return null;
  return (
    <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onClick}>
      {t('submitRevision')}
    </Button>
  );
}

function ExamPickerBlock({
  component,
  onExamSelect,
}: {
  component: Extract<EnglishTutorEnvelopeComponent, { type: 'exam_picker' }>;
  onExamSelect?: (option: ExamPickerOption) => void;
}) {
  const t = useTranslations('english.envelope');
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
        {t('examPickerTitle')}
      </p>
      <div className="flex flex-col gap-1.5">
        {component.options.map((option) => {
          const selected = component.selected_id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={!onExamSelect}
              onClick={() => onExamSelect?.(option)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                selected
                  ? 'border-kazi-orange/50 bg-workspace-active'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              )}
            >
              <p className="text-sm font-medium text-[#1D2129]">{option.label}</p>
              {option.description ? (
                <p className="mt-0.5 text-xs text-[#86909C]">{option.description}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EssayPromptBlock({
  component,
}: {
  component: Extract<EnglishTutorEnvelopeComponent, { type: 'essay_prompt' }>;
}) {
  const t = useTranslations('english.envelope');
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[#1D2129]">{component.title}</p>
        {component.exam_type ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#4E5969] ring-1 ring-gray-200">
            {component.exam_type}
          </span>
        ) : null}
        {component.word_limit ? (
          <span className="text-[10px] text-[#86909C]">
            {t('wordLimit', { count: component.word_limit })}
          </span>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#4E5969]">
        {component.body}
      </p>
      {component.ai_synthetic ? <AiSyntheticDisclaimer /> : null}
    </div>
  );
}

function buildHighlightedSegments(text: string, issues: EssaySpanIssue[]) {
  const sorted = [...issues].sort((a, b) => a.start - b.start);
  const segments: Array<{ text: string; issue?: EssaySpanIssue }> = [];
  let cursor = 0;
  for (const issue of sorted) {
    const start = Math.max(0, Math.min(text.length, issue.start));
    const end = Math.max(start, Math.min(text.length, issue.end));
    if (start > cursor) {
      segments.push({ text: text.slice(cursor, start) });
    }
    if (end > start) {
      segments.push({ text: text.slice(start, end), issue });
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }
  return segments;
}

function EssayDiffBlock({
  component,
  onFocusComposer,
}: {
  component: EssayDiffComponent;
  onFocusComposer?: () => void;
}) {
  const t = useTranslations('english.envelope');
  const segments = useMemo(
    () => buildHighlightedSegments(component.original, component.issues),
    [component.original, component.issues]
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
          {t('essayOriginal')}
        </p>
        <p className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-sm leading-relaxed text-[#1D2129]">
          {segments.map((segment, index) =>
            segment.issue ? (
              <mark
                key={`${segment.issue.start}-${index}`}
                title={`${segment.issue.category}: ${segment.issue.message}`}
                className="rounded bg-amber-100 px-0.5 text-amber-950 underline decoration-amber-400/80"
              >
                {segment.text}
              </mark>
            ) : (
              <span key={`plain-${index}`}>{segment.text}</span>
            )
          )}
        </p>
      </div>

      {component.issues.length > 0 ? (
        <ul className="space-y-2">
          {component.issues.map((issue, index) => (
            <li
              key={`${issue.start}-${issue.end}-${index}`}
              className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-950"
            >
              <p className="font-medium">{issue.category}</p>
              <p className="mt-0.5">{issue.message}</p>
              {issue.rewrite_example ? (
                <p className="mt-1 text-[11px] text-amber-900/90">
                  {t('rewriteExample', { text: issue.rewrite_example })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {component.rewrite ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
            {t('essayRewrite')}
          </p>
          <p className="whitespace-pre-wrap rounded-lg border border-green-100 bg-green-50/60 p-3 text-sm leading-relaxed text-green-950">
            {component.rewrite}
          </p>
        </div>
      ) : null}

      <ReviseCtaButton onClick={onFocusComposer} />
    </div>
  );
}

function DimensionBars({
  dimensions,
  title,
}: {
  dimensions: ScoreDimension[];
  title?: string;
}) {
  const t = useTranslations('english.envelope');
  return (
    <div className="space-y-2">
      {title ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
          {title}
        </p>
      ) : null}
      <div className="space-y-2">
        {dimensions.map((dim) => {
          const max = dim.max && dim.max > 0 ? dim.max : 9;
          const pct = Math.max(0, Math.min(100, (dim.score / max) * 100));
          const label = dim.label ?? t(`dimensions.${dim.key}`, { defaultValue: dim.key });
          return (
            <div key={dim.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-[#4E5969]">{label}</span>
                <span className="tabular-nums font-semibold text-[#1D2129]">
                  {dim.score}
                  {dim.max ? ` / ${dim.max}` : ''}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-kazi-orange transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** MVP speaking profile: SVG polygon + dimension bars (not a full charting lib). */
function SpeakingRadarBlock({
  component,
}: {
  component: Extract<EnglishTutorEnvelopeComponent, { type: 'speaking_radar' }>;
}) {
  const t = useTranslations('english.envelope');
  const size = 180;
  const center = size / 2;
  const radius = 68;
  const count = component.dimensions.length;
  const points = component.dimensions.map((dim, index) => {
    const max = dim.max && dim.max > 0 ? dim.max : 9;
    const ratio = Math.max(0, Math.min(1, dim.score / max));
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius * ratio;
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
      label: dim.label ?? dim.key,
      score: dim.score,
    };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
        {t('speakingRadarTitle')}
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          {[0.25, 0.5, 0.75, 1].map((level) => (
            <circle
              key={level}
              cx={center}
              cy={center}
              r={radius * level}
              fill="none"
              stroke="#E5E6EB"
              strokeWidth="1"
            />
          ))}
          <polygon
            points={polygon}
            fill="rgba(255, 122, 26, 0.18)"
            stroke="#FF7A1A"
            strokeWidth="2"
          />
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r="3" fill="#FF7A1A" />
          ))}
        </svg>
        <div className="min-w-0 flex-1">
          <DimensionBars dimensions={component.dimensions} />
        </div>
      </div>
      {component.summary ? (
        <p className="text-sm leading-relaxed text-[#4E5969]">{component.summary}</p>
      ) : null}
    </div>
  );
}

function WritingScorecardBlock({
  component,
  onFocusComposer,
}: {
  component: Extract<EnglishTutorEnvelopeComponent, { type: 'writing_scorecard' }>;
  onFocusComposer?: () => void;
}) {
  const t = useTranslations('english.envelope');
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[#1D2129]">{t('writingScorecardTitle')}</p>
        {component.overall != null ? (
          <span className="rounded-full bg-workspace-active px-2.5 py-0.5 text-sm font-semibold text-kazi-navy">
            {component.overall}
          </span>
        ) : null}
      </div>
      <DimensionBars dimensions={component.dimensions} />
      {component.summary ? (
        <p className="text-sm leading-relaxed text-[#4E5969]">{component.summary}</p>
      ) : null}
      {component.show_revise_cta ? (
        <ReviseCtaButton onClick={onFocusComposer} />
      ) : null}
    </div>
  );
}

function ModelAnswerBlock({
  component,
}: {
  component: Extract<EnglishTutorEnvelopeComponent, { type: 'model_answer' }>;
}) {
  const t = useTranslations('english.envelope');
  return (
    <div className="space-y-2 rounded-lg border border-sky-100 bg-sky-50/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-900/70">
        {t('modelAnswerTitle')}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1D2129]">
        {component.text}
      </p>
      {component.audio_url ? (
        <audio controls preload="none" className="w-full">
          <source src={component.audio_url} />
        </audio>
      ) : null}
    </div>
  );
}

function ProgressSummaryBlock({
  component,
}: {
  component: Extract<EnglishTutorEnvelopeComponent, { type: 'progress_summary' }>;
}) {
  const t = useTranslations('english.envelope');
  const window = component.window;
  const hasStructured =
    Boolean(component.trend) ||
    component.current_estimate != null ||
    Boolean(window) ||
    (component.resolved_tags?.length ?? 0) > 0;
  const legacyItems = component.items ?? [];

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#86909C]">
        {t('progressSummaryTitle')}
      </p>
      {hasStructured ? (
        <dl className="space-y-1.5">
          {component.trend ? (
            <div className="flex items-start justify-between gap-3 text-sm">
              <dt className="text-[#86909C]">{t('progressTrend')}</dt>
              <dd className="font-medium text-[#1D2129]">
                {t(`progressTrendValues.${component.trend}`, {
                  defaultValue: component.trend,
                })}
              </dd>
            </div>
          ) : null}
          {component.current_estimate != null ? (
            <div className="flex items-start justify-between gap-3 text-sm">
              <dt className="text-[#86909C]">{t('progressCurrentEstimate')}</dt>
              <dd className="font-medium text-[#1D2129]">{component.current_estimate}</dd>
            </div>
          ) : null}
          {window &&
          (window.from != null || window.to != null || window.delta != null) ? (
            <div className="flex items-start justify-between gap-3 text-sm">
              <dt className="text-[#86909C]">
                {t('progressWindow', { count: window.n ?? 0 })}
              </dt>
              <dd className="font-medium text-[#1D2129]">
                {window.from != null && window.to != null
                  ? t('progressWindowRange', {
                      from: window.from,
                      to: window.to,
                      delta: window.delta ?? 0,
                    })
                  : window.delta != null
                    ? t('progressWindowDelta', { delta: window.delta })
                    : '—'}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {(component.resolved_tags?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {component.resolved_tags!.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-[#4E5969] ring-1 ring-gray-200"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      {legacyItems.length > 0 ? (
        <dl className="space-y-1.5">
          {legacyItems.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <dt className="text-[#86909C]">{item.label}</dt>
              <dd className="font-medium text-[#1D2129]">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Render english_tutor Cap envelope blocks inside assistant bubbles (KAZI-502). */
export function EnglishTutorEnvelopeBlocks({
  components,
  lowConfidence = false,
  onFocusComposer,
  onExamSelect,
  className,
}: EnglishTutorEnvelopeBlocksProps) {
  if (components.length === 0 && !lowConfidence) return null;

  return (
    <div className={cn('mt-3 space-y-3 border-t border-gray-200/80 pt-3', className)}>
      {lowConfidence ? <LowConfidenceBanner /> : null}
      {components.map((component, index) => {
        const key = `${component.type}-${index}`;
        switch (component.type) {
          case 'exam_picker':
            return (
              <ExamPickerBlock
                key={key}
                component={component}
                onExamSelect={onExamSelect}
              />
            );
          case 'essay_prompt':
            return <EssayPromptBlock key={key} component={component} />;
          case 'essay_diff':
            return (
              <EssayDiffBlock
                key={key}
                component={component}
                onFocusComposer={onFocusComposer}
              />
            );
          case 'writing_scorecard':
            return (
              <WritingScorecardBlock
                key={key}
                component={component}
                onFocusComposer={onFocusComposer}
              />
            );
          case 'speaking_radar':
            return <SpeakingRadarBlock key={key} component={component} />;
          case 'model_answer':
            return <ModelAnswerBlock key={key} component={component} />;
          case 'progress_summary':
            return <ProgressSummaryBlock key={key} component={component} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
