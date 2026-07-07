"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMe, patchMe, type PatchMeBody } from "@/lib/api-client";
import { setUserInfo } from "@/lib/auth";
import { useAuthStore, useUIStore } from "@/lib/store";
import type { User } from "@/types";

interface ProfilePageProps {
  params: { locale: string };
}

type ProfileForm = {
  displayName: string;
  country: string;
  careerGoal: string;
  targetRole: string;
  englishLevel: string;
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
  currentStatus: "student",
  education: "",
  experience: "",
};

function countryFromApi(value?: string): string {
  const upper = (value ?? "").toUpperCase();
  return upper === "KZ" || upper === "UZ" ? upper : "";
}

function formFromUser(user: User): ProfileForm {
  return {
    displayName: user.displayName ?? "",
    country: countryFromApi(user.country),
    careerGoal: user.careerGoal ?? "",
    targetRole: user.targetRole ?? "",
    englishLevel: user.englishLevel ?? "",
    currentStatus: user.currentStatus ?? "student",
    education: user.education ?? "",
    experience: user.experience ?? "",
  };
}

function buildPatchBody(form: ProfileForm): PatchMeBody {
  const body: PatchMeBody = {};

  if (form.country === "KZ" || form.country === "UZ") {
    body.primary_country = form.country;
  }
  if (form.careerGoal.trim()) {
    body.career_goal = form.careerGoal.trim();
  }
  if (form.targetRole.trim()) {
    body.target_role = form.targetRole.trim();
  }
  if (form.englishLevel) {
    body.english_level = form.englishLevel;
  }
  if (form.currentStatus) {
    body.current_status = form.currentStatus;
  }
  if (form.education.trim()) {
    body.education_text = form.education.trim();
  }
  if (form.experience.trim()) {
    body.experience_text = form.experience.trim();
  }

  return body;
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const showToast = useUIStore((s) => s.showToast);
  const { locale } = params;
  const { isLoggedIn, token, updateUser } = useAuthStore();

  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        updateUser(res.data);
        setForm(formFromUser(res.data));
      } else {
        const cached = useAuthStore.getState().user;
        if (cached) {
          setForm(formFromUser(cached));
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

    const body = buildPatchBody(form);
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

    updateUser(res.data);
    setUserInfo(res.data);
    showToast(t("saveSuccess"), "info");
    router.push(`/${locale}/mine`);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header locale={locale} />
        <main className="pt-20 px-4 max-w-lg mx-auto text-center space-y-4">
          <p className="text-sm text-gray-600">{t("loginRequired")}</p>
          <Button onClick={() => router.push(`/${locale}/login`)}>{t("signIn")}</Button>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header locale={locale} />
        <main className="pt-20 px-4 max-w-lg mx-auto flex justify-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-kazi-orange rounded-full animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>
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
              onClick={() => router.back()}
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
    </div>
  );
}
