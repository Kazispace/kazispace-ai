"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMe, patchMe, type PatchMeBody } from "@/lib/api-client";
import { setUserInfo } from "@/lib/auth";
import { canEnterCvBuilder } from "@/lib/nba-display";
import {
  formatMissingFieldFallback,
  isKnownMissingMinimumField,
} from "@/lib/profile-completion";
import {
  LOCALE_LABELS,
  readLanguagePreference,
  switchLocalePath,
  syncProfileLanguageCookie,
} from "@/lib/locale";
import { isSupportedLocale, type SupportedLocale } from "@/lib/constants";
import { buildClinicCvRailOpenHref } from "@/lib/cv-entry";
import { useAuthStore, useUIStore } from "@/lib/store";
import type { ProfileCompletion, User } from "@/types";

interface ProfilePageProps {
  params: { locale: string };
}

type ProfileForm = {
  displayName: string;
  country: string;
  careerGoal: string;
  targetRole: string;
  englishLevel: string;
  weeklyHoursBudget: string;
  currentStatus: string;
  education: string;
  experience: string;
};

const EMPTY_FORM: ProfileForm = {
  displayName: "",
  country: "",
  careerGoal: "",
  targetRole: "",
  englishLevel: "",
  weeklyHoursBudget: "",
  currentStatus: "student",
  education: "",
  experience: "",
};

function countryFromApi(value?: string): string {
  const upper = (value ?? "").toUpperCase();
  return upper === "KZ" || upper === "UZ" || upper === "CN" ? upper : "";
}

function formFromUser(user: User): ProfileForm {
  return {
    displayName: user.displayName ?? "",
    country: countryFromApi(user.country),
    careerGoal: user.careerGoal ?? "",
    targetRole: user.targetRole ?? "",
    englishLevel: user.englishLevel ?? "",
    weeklyHoursBudget:
      user.weeklyHoursBudget != null ? String(user.weeklyHoursBudget) : "",
    currentStatus: user.currentStatus ?? "student",
    education: user.education ?? "",
    experience: user.experience ?? "",
  };
}

function buildPatchBody(initial: ProfileForm, current: ProfileForm): PatchMeBody {
  const body: PatchMeBody = {};

  if (current.country !== initial.country) {
    body.primary_country =
      current.country === "KZ" || current.country === "UZ" || current.country === "CN"
        ? current.country
        : null;
  }
  if (current.careerGoal !== initial.careerGoal) {
    body.career_goal = current.careerGoal.trim() || null;
  }
  if (current.targetRole !== initial.targetRole) {
    body.target_role = current.targetRole.trim() || null;
  }
  if (current.englishLevel !== initial.englishLevel) {
    body.english_level = current.englishLevel || null;
  }
  if (current.weeklyHoursBudget !== initial.weeklyHoursBudget) {
    const parsed = current.weeklyHoursBudget.trim();
    body.weekly_hours_budget = parsed ? Number(parsed) : null;
  }
  if (current.currentStatus !== initial.currentStatus) {
    body.current_status = current.currentStatus || null;
  }
  if (current.education !== initial.education) {
    body.education_text = current.education.trim() || null;
  }
  if (current.experience !== initial.experience) {
    body.experience_text = current.experience.trim() || null;
  }

  return body;
}

function missingFieldLabel(
  field: string,
  t: ReturnType<typeof useTranslations<"profile">>
): string {
  if (isKnownMissingMinimumField(field)) {
    return t(`missingFields.${field}`);
  }
  return formatMissingFieldFallback(field);
}

function ProfilePageShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      {children}
      <BottomNav
        locale={locale}
        activeAliases={{ [`/${locale}/profile`]: `/${locale}/mine` }}
      />
    </div>
  );
}

function ProfilePageContent({ locale }: { locale: string }) {
  const t = useTranslations("profile");
  const tChat = useTranslations("chat");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const showToast = useUIStore((s) => s.showToast);
  const { isLoggedIn, token, updateUser } = useAuthStore();

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM);
  const [profileCompletion, setProfileCompletion] = useState<ProfileCompletion | null>(null);
  const [loadedPreference, setLoadedPreference] = useState<SupportedLocale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const returnToCv = searchParams.get("return") === "cv";
  const routeLocale = isSupportedLocale(locale) ? locale : null;
  const preferenceMismatch =
    loadedPreference && routeLocale && loadedPreference !== routeLocale;

  const applyLoadedUser = (user: User) => {
    const loaded = formFromUser(user);
    updateUser(user);
    setUserInfo(user);
    setForm(loaded);
    setInitialForm(loaded);
    setProfileCompletion(user.profileCompletion ?? null);
    setLoadedPreference(readLanguagePreference(user.primaryLocale));
  };

  useEffect(() => {
    if (!isLoggedIn || !token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      const res = await getMe();
      if (cancelled) return;
      if (res.success && res.data) {
        applyLoadedUser(res.data);
      } else {
        const cached = useAuthStore.getState().user;
        if (cached) {
          const loaded = formFromUser(cached);
          setForm(loaded);
          setInitialForm(loaded);
        }
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, token, updateUser]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn) {
      router.push(`/${locale}/login`);
      return;
    }

    const body = buildPatchBody(initialForm, form);
    if (Object.keys(body).length === 0) {
      showToast(t("saveNothing"), "info");
      return;
    }

    setIsSaving(true);
    const res = await patchMe(body);
    setIsSaving(false);

    if (!res.success || !res.data) {
      showToast(res.error ?? t("saveFailed"), "error");
      return;
    }

    applyLoadedUser(res.data);
    showToast(t("saveSuccess"), "info");

    const preference =
      readLanguagePreference(res.data.primaryLocale) ??
      (isSupportedLocale(locale) ? locale : "en");
    const nextRoute = preference;

    if (returnToCv && canEnterCvBuilder(res.data)) {
      router.push(buildClinicCvRailOpenHref(nextRoute));
      return;
    }
    router.push(
      switchLocalePath(
        `/${isSupportedLocale(locale) ? locale : preference}/mine`,
        nextRoute
      )
    );
  };

  const handleCancel = () => {
    router.replace(`/${locale}/chat`);
  };

  if (!isLoggedIn) {
    return (
      <ProfilePageShell locale={locale}>
        <main className="pt-20 px-4 max-w-lg mx-auto text-center space-y-4">
          <Link
            href={`/${locale}/chat`}
            className="text-sm text-primary font-medium inline-block mb-4"
          >
            {tChat("backToClinic")}
          </Link>
          <p className="text-sm text-gray-600">{t("loginRequired")}</p>
          <Button onClick={() => router.push(`/${locale}/login`)}>{t("signIn")}</Button>
        </main>
      </ProfilePageShell>
    );
  }

  if (isLoading) {
    return (
      <ProfilePageShell locale={locale}>
        <main className="pt-20 px-4 max-w-lg mx-auto flex justify-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
        </main>
      </ProfilePageShell>
    );
  }

  return (
    <ProfilePageShell locale={locale}>
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <Link
          href={`/${locale}/chat`}
          className="text-sm text-primary font-medium mb-4 inline-block"
        >
          {tChat("backToClinic")}
        </Link>
        <h1 className="text-2xl font-bold text-kazi-navy mb-2">{t("title")}</h1>
        {(returnToCv ||
          (profileCompletion && !profileCompletion.minimumComplete)) && (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed">
            {returnToCv ? t("gateContextCv") : t("gateContextGeneral")}
          </p>
        )}
        {preferenceMismatch && loadedPreference && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 mb-4 flex items-center justify-between gap-3">
            <p className="text-xs text-blue-900">
              {t("preferenceMismatchHint", { lang: LOCALE_LABELS[loadedPreference] })}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              onClick={() => {
                syncProfileLanguageCookie(loadedPreference);
                window.location.assign(switchLocalePath(pathname, loadedPreference));
              }}
            >
              {t("preferenceMismatchAction", { lang: LOCALE_LABELS[loadedPreference] })}
            </Button>
          </div>
        )}
        {profileCompletion &&
          !profileCompletion.minimumComplete &&
          profileCompletion.missingMinimum.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
              <p className="text-sm font-medium text-amber-900">
                {t("completionBannerTitle")}
              </p>
              <p className="text-xs text-amber-800 mt-1">{t("completionBannerHint")}</p>
              <ul className="text-xs text-amber-900 mt-2 list-disc pl-4 space-y-0.5">
                {profileCompletion.missingMinimum.map((field) => (
                  <li key={field}>{missingFieldLabel(field, t)}</li>
                ))}
              </ul>
            </div>
          )}
        <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("displayNameLabel")}
                </label>
                <Input value={form.displayName} disabled className="bg-gray-50" />
                <p className="text-xs text-gray-500 mt-1">{t("displayNameReadOnly")}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("countryLabel")}
                </label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                >
                  <option value="">{t("countryUnset")}</option>
                  <option value="KZ">{t("countries.kz")}</option>
                  <option value="UZ">{t("countries.uz")}</option>
                  <option value="CN">{t("countries.cn")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("careerGoalLabel")}
                </label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={form.careerGoal}
                  onChange={(e) => setForm({ ...form, careerGoal: e.target.value })}
                >
                  <option value="">{t("careerGoalUnset")}</option>
                  <option value="better_job">{t("goals.better_job")}</option>
                  <option value="interview_prep">{t("goals.interview_prep")}</option>
                  <option value="cv_build">{t("goals.cv_build")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("targetRoleLabel")}
                </label>
                <Input
                  value={form.targetRole}
                  onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                  placeholder={t("targetRolePlaceholder")}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("englishLevelLabel")}
                </label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={form.englishLevel}
                  onChange={(e) => setForm({ ...form, englishLevel: e.target.value })}
                >
                  <option value="">{t("englishLevelUnset")}</option>
                  <option value="beginner">{t("englishLevels.beginner")}</option>
                  <option value="intermediate">{t("englishLevels.intermediate")}</option>
                  <option value="advanced">{t("englishLevels.advanced")}</option>
                  <option value="fluent">{t("englishLevels.fluent")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("weeklyHoursLabel")}
                </label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={form.weeklyHoursBudget}
                  onChange={(e) => setForm({ ...form, weeklyHoursBudget: e.target.value })}
                >
                  <option value="">{t("weeklyHoursUnset")}</option>
                  <option value="5">{t("weeklyHoursOptions.five")}</option>
                  <option value="10">{t("weeklyHoursOptions.ten")}</option>
                  <option value="15">{t("weeklyHoursOptions.fifteen")}</option>
                  <option value="20">{t("weeklyHoursOptions.twenty")}</option>
                  <option value="30">{t("weeklyHoursOptions.thirty")}</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">{t("weeklyHoursHint")}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("currentStatusLabel")}
                </label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={form.currentStatus}
                  onChange={(e) => setForm({ ...form, currentStatus: e.target.value })}
                >
                  <option value="student">{t("statuses.student")}</option>
                  <option value="employed">{t("statuses.employed")}</option>
                  <option value="job_seeker">{t("statuses.job_seeker")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("educationLabel")}
                </label>
                <textarea
                  className="w-full text-sm border border-input rounded-md p-3 min-h-[100px] bg-background"
                  placeholder={t("educationPlaceholder")}
                  value={form.education}
                  onChange={(e) => setForm({ ...form, education: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("experienceLabel")}
                </label>
                <textarea
                  className="w-full text-sm border border-input rounded-md p-3 min-h-[120px] bg-background"
                  placeholder={t("experiencePlaceholder")}
                  value={form.experience}
                  onChange={(e) => setForm({ ...form, experience: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleCancel}
              disabled={isSaving}
            >
              {t("cancelButton")}
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? t("saving") : t("saveButton")}
            </Button>
          </div>
        </form>
      </main>
    </ProfilePageShell>
  );
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const { locale } = params;
  return (
    <Suspense
      fallback={
        <ProfilePageShell locale={locale}>
          <main className="pt-20 px-4 max-w-lg mx-auto flex justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
          </main>
        </ProfilePageShell>
      }
    >
      <ProfilePageContent locale={locale} />
    </Suspense>
  );
}
