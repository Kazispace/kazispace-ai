'use client';

import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JobDetailRailExternalViewProps {
  url: string;
  className?: string;
}

/**
 * Embed an external apply URL in the rail.
 * Many employer sites set X-Frame-Options — keep a always-visible “open in new tab”
 * escape hatch (iframe onError is unreliable for framing blocks).
 */
export function JobDetailRailExternalView({
  url,
  className,
}: JobDetailRailExternalViewProps) {
  const t = useTranslations('jobs');

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <p className="min-w-0 truncate text-xs text-gray-500" title={url}>
          {url}
        </p>
        <Button
          asChild
          size="sm"
          variant="outline"
          className="h-7 shrink-0 gap-1 px-2 text-xs"
        >
          <a href={url} target="_blank" rel="noopener noreferrer">
            {t('applyOpenExternal')}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        </Button>
      </div>
      <iframe
        title={t('apply')}
        src={url}
        className="min-h-0 w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
