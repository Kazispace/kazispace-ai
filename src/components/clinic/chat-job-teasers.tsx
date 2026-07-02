"use client";

import Link from "next/link";
import { Lock, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";

import { JobLogo } from "@/components/jobs/job-logo";
import type { ChatJobCard } from "@/types/chat-envelope";

interface ChatJobTeasersProps {
  cards: ChatJobCard[];
  locale: string;
  onCardClick?: (card: ChatJobCard) => void;
}

export function ChatJobTeasers({ cards, locale, onCardClick }: ChatJobTeasersProps) {
  const t = useTranslations("jobs");

  if (cards.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200/80 flex flex-col gap-2">
      {cards.map((card, index) => {
        const href = card.job_id
          ? `/${locale}/jobs/${encodeURIComponent(card.job_id)}`
          : `/${locale}/jobs`;
        const key = card.job_id ?? `${card.title ?? "job"}-${index}`;

        const inner = (
          <>
            <JobLogo
              logoUrl={card.logo_url}
              company={card.company ?? ""}
              className="w-9 h-9"
              iconClassName="w-4 h-4"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate">
                {card.title ?? t("title")}
              </p>
              {card.company && (
                <p className="text-xs text-gray-500 truncate">{card.company}</p>
              )}
              {(card.location || card.work_mode) && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">
                    {[card.location, card.work_mode].filter(Boolean).join(" · ")}
                  </span>
                </p>
              )}
              {card.salary && (
                <p className="text-xs text-gray-500 mt-0.5">{card.salary}</p>
              )}
            </div>
            {card.match_score != null && (
              <span className="text-xs font-semibold text-kazi-orange shrink-0">
                {t("matchScore", { score: Math.round(card.match_score) })}
              </span>
            )}
            {card.is_locked && (
              <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden />
            )}
          </>
        );

        if (onCardClick) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCardClick(card)}
              className="flex items-center gap-3 w-full text-left rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 hover:border-kazi-orange/40 hover:bg-orange-50/50 transition-colors"
            >
              {inner}
            </button>
          );
        }

        return (
          <Link
            key={key}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 hover:border-kazi-orange/40 hover:bg-orange-50/50 transition-colors"
          >
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
