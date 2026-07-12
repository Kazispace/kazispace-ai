"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { AgentTransitionProvider } from "@/components/agent-transition/agent-transition-provider";
import { EppOnboarding } from "@/components/english/epp-onboarding";
import { EppPassportHome } from "@/components/english/epp-passport-home";
import { EppPassportSkeleton } from "@/components/english/epp-passport-skeleton";
import { EppSampleJobsPanel } from "@/components/english/epp-sample-jobs-panel";
import { Button } from "@/components/ui/button";
import { EPP_PROFILE_ENABLED } from "@/lib/constants";
import { ENGLISH_TUTOR_AGENT_ID } from "@/lib/english-tutor-config";
import { useEnglishProfile, useEnglishSampleJobs } from "@/hooks/use-english-profile";
import { useHubActiveAgentSync } from "@/hooks/use-hub-active-agent-sync";
import { useAuthStore } from "@/lib/store";
import type { EnglishOnboardingRequest, EnglishProfile } from "@/types";

interface PassportPageProps {
  params: { locale: string };
}

function PassportSampleJobs({ profile }: { profile: EnglishProfile }) {
  const { sampleJobs } = useEnglishSampleJobs(profile.display_level, { enabled: true });

  if (!sampleJobs) return null;

  return (
    <div id="sample-jobs" className="max-w-lg mx-auto w-full px-4 pb-4 scroll-mt-4">
      <EppSampleJobsPanel sampleJobs={sampleJobs} />
    </div>
  );
}

function PassportPageContent({ locale }: { locale: string }) {
  const t = useTranslations("english");
  const router = useRouter();

  const {
    profile,
    profileStatus,
    isProfileLoading,
    profileError,
    refetchProfile,
    submitOnboarding,
    isOnboardingSaving,
  } = useEnglishProfile({ enabled: EPP_PROFILE_ENABLED });

  useHubActiveAgentSync(locale, ENGLISH_TUTOR_AGENT_ID, EPP_PROFILE_ENABLED);

  if (!EPP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
      </div>
    );
  }

  if (isProfileLoading) {
    return <EppPassportSkeleton />;
  }

  if (profileError && !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <p className="text-sm text-red-600">{profileError}</p>
        <Button size="sm" onClick={() => void refetchProfile()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (profileStatus === "empty" || !profile) {
    const handleOnboarding = async (data: EnglishOnboardingRequest) => {
      await submitOnboarding(data);
      router.push(`/${locale}/english/assessment`);
    };

    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto w-full px-4 pt-4">
          <Link href={`/${locale}/english`} className="text-xs text-kazi-orange font-medium">
            {t("passportPage.back")}
          </Link>
        </div>
        <EppOnboarding onComplete={(d) => void handleOnboarding(d)} isSaving={isOnboardingSaving} />
      </div>
    );
  }

  if (profile.profile_status === "ready" || profile.profile_status === "active") {
    return (
      <div className="flex-1 flex flex-col">
        <div className="max-w-lg mx-auto w-full px-4 pt-4">
          <Link href={`/${locale}/english`} className="text-xs text-kazi-orange font-medium">
            {t("passportPage.back")}
          </Link>
        </div>
        <EppPassportHome profile={profile} locale={locale} />
        <PassportSampleJobs profile={profile} />
      </div>
    );
  }

  return <EppPassportSkeleton />;
}

export default function EnglishPassportPage({ params }: PassportPageProps) {
  const t = useTranslations("english");
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  return (
    <AgentTransitionProvider
      locale={params.locale}
      fromSurface="english"
      hubAgentId={ENGLISH_TUTOR_AGENT_ID}
      isLoggedIn={isLoggedIn}
    >
      <div className="min-h-0 h-full bg-gray-50 flex flex-col">
        <main className="flex-1 flex flex-col">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center text-gray-500">
                {t("loading")}
              </div>
            }
          >
            <PassportPageContent locale={params.locale} />
          </Suspense>
        </main>
      </div>
    </AgentTransitionProvider>
  );
}
