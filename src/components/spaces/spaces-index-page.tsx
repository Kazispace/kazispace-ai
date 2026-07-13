'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { SpaceTemplatePicker } from '@/components/spaces/space-template-picker';
import {
  SpaceWorkspaceError,
  SpaceWorkspaceLoading,
} from '@/components/spaces/space-workspace-states';
import { useSpaces } from '@/hooks/use-spaces';
import { createSpace } from '@/lib/spaces-api';
import { pickLatestUserSpace } from '@/lib/spaces/routes';
import { useUIStore } from '@/lib/store';

interface SpacesIndexPageProps {
  locale: string;
}

/**
 * `/spaces` index — open latest user space, or prompt to create the first one.
 * Each space workspace lives at `/spaces/{id}` (name + master_session_id from BE).
 */
export function SpacesIndexPage({ locale }: SpacesIndexPageProps) {
  const router = useRouter();
  const t = useTranslations('spaces');
  const showToast = useUIStore((s) => s.showToast);
  const { spaces, isLoading, error } = useSpaces({ panelOpen: true });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const latestUserSpace = useMemo(() => pickLatestUserSpace(spaces), [spaces]);

  useEffect(() => {
    if (isLoading || !latestUserSpace) {
      return;
    }
    router.replace(`/${locale}/spaces/${encodeURIComponent(latestUserSpace.id)}`);
  }, [isLoading, latestUserSpace, locale, router]);

  const handleCreateSpace = useCallback(
    async (templateId: string) => {
      setIsCreating(true);
      const res = await createSpace({ template_id: templateId });
      setIsCreating(false);
      if (!res.success || !res.data) {
        showToast(res.error ?? t('createFailed'), 'error');
        return;
      }
      setPickerOpen(false);
      router.push(`/${locale}/spaces/${encodeURIComponent(res.data.id)}`);
    },
    [locale, router, showToast, t]
  );

  if (isLoading || latestUserSpace) {
    return <SpaceWorkspaceLoading />;
  }

  if (error) {
    return <SpaceWorkspaceError message={error} />;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-gray-bg px-6 text-center">
      <p className="text-base font-medium text-[#1D2129]">{t('indexEmptyTitle')}</p>
      <p className="max-w-sm text-sm text-[#86909C]">{t('indexEmptyHint')}</p>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={isCreating}
        className="rounded-lg bg-kazi-orange px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {t('indexCreateFirst')}
      </button>
      <SpaceTemplatePicker
        open={pickerOpen}
        isCreating={isCreating}
        onClose={() => setPickerOpen(false)}
        onSelect={(templateId) => void handleCreateSpace(templateId)}
      />
    </div>
  );
}
