"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { IrpProfileHome } from "@/components/interview/irp-profile-home";
import { Button } from "@/components/ui/button";
import { IRP_PROFILE_ENABLED } from "@/lib/constants";
import { useInterviewProfile } from "@/hooks/use-interview-profile";
import { useBilling } from "@/hooks/use-billing";
import { isProPlan } from "@/lib/api-mappers";

interface ProfilePageProps {
  params: { locale: string };
}

function ProfilePageContent({ locale }: { locale: string }) {
  const t = useTranslations("interview.irp");
  const router = useRouter();
  const { profile, isProfileLoading, profileError, refetchProfile } =
    useInterviewProfile({ enabled: IRP_PROFILE_ENABLED });
  const { plan } = useBilling();
  const isProUser = isProPlan(plan);

  if (!IRP_PROFILE_ENABLED) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">{t("featureDisabled")}</p>
      </div>
    );
  }

  if (isProfileLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (profileError && !profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
        <p className="text-sm text-red-600">{profileError}</p>
        <Button size="sm" onClick={() => void refetchProfile()}>
          {t("profileRetry")}
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full p-4 gap-4">
        <Link href={`/${locale}/interview`} className="text-xs text-primary font-medium">
          {t("profile.back")}
        </Link>
        <p className="text-sm text-gray-600">{t("readiness.noProfile")}</p>
        <Button size="sm" asChild>
          <Link href={`/${locale}/interview`}>{t("readiness.startTraining")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-4 pt-4">
        <Link href={`/${locale}/interview`} className="text-xs text-primary font-medium">
          {t("profile.back")}
        </Link>
      </div>
      <IrpProfileHome
        profile={profile}
        locale={locale}
        isPro={isProUser}
        onStartTraining={() => router.push(`/${locale}/interview`)}
      />
      <div className="max-w-lg mx-auto w-full px-4 pb-4">
        <Button size="sm" variant="outline" className="self-start" asChild>
          <Link href={`/${locale}/interview`}>{t("profile.backToInterview")}</Link>
        </Button>
      </div>
    </div>
  );
}

export default function InterviewProfilePage({ params }: ProfilePageProps) {
  const t = useTranslations("interview");

  return (
    <div className="min-h-0 h-full bg-gray-50 flex flex-col">
      <main className="flex-1 flex flex-col">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {t("loading")}
            </div>
          }
        >
          <ProfilePageContent locale={params.locale} />
        </Suspense>
      </main>
    </div>
  );
}
