"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Button } from "@/components/ui/button";
import { EppOnboarding } from "@/components/english/epp-onboarding";
import { EppPassportHome } from "@/components/english/epp-passport-home";
import { EppPassportSkeleton } from "@/components/english/epp-passport-skeleton";
import { EPP_PROFILE_ENABLED } from "@/lib/constants";
import { useEnglishProfile } from "@/hooks/use-english-profile";
import type { EnglishOnboardingRequest } from "@/types";

interface EnglishPageProps {
  params: { locale: string };
}

function EnglishPageContent({ locale }: { locale: string }) {
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

  if (!EPP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 text-center">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
        <Button asChild>
          <Link href={`/${locale}/chat`}>{t("backToClinic")}</Link>
        </Button>
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
      <EppOnboarding onComplete={(d) => void handleOnboarding(d)} isSaving={isOnboardingSaving} />
    );
  }

  if (profile && (profile.profile_status === "ready" || profile.profile_status === "active")) {
    return <EppPassportHome profile={profile} locale={locale} />;
  }

  return <EppPassportSkeleton />;
}

export default function EnglishPage({ params }: EnglishPageProps) {
  const t = useTranslations("english");
  return (
    <div className="min-h-screen bg-gray-50 pb-20 flex flex-col">
      <Header locale={params.locale} />
      <main className="pt-16 flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {t("loading")}
            </div>
          }
        >
          <EnglishPageContent locale={params.locale} />
        </Suspense>
      </main>
      <BottomNav locale={params.locale} />
    </div>
  );
}
