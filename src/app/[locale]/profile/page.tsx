"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ProfilePageProps {
  params: { locale: string };
}

export default function ProfilePage({ params }: ProfilePageProps) {
  const t = useTranslations("profile");
  const router = useRouter();
  const { locale } = params;
  
  const [form, setForm] = useState({
    displayName: "",
    country: "kz",
    targetRole: "",
    currentStatus: "student",
    education: "",
    experience: "",
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(t("saveSuccess"));
    router.push(`/${locale}/mine`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>
        <form onSubmit={handleSave} className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t("displayNameLabel")}</label>
                <Input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} placeholder={t("displayNamePlaceholder")} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t("countryLabel")}</label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={form.country} onChange={e => setForm({...form, country: e.target.value})}>
                  <option value="kz">{t("countries.kz")}</option>
                  <option value="uz">{t("countries.uz")}</option>
                  <option value="other">{t("countries.other")}</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t("targetRoleLabel")}</label>
                <Input value={form.targetRole} onChange={e => setForm({...form, targetRole: e.target.value})} placeholder={t("targetRolePlaceholder")} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{t("currentStatusLabel")}</label>
                <select className="w-full h-10 px-3 rounded-md border border-input bg-background" value={form.currentStatus} onChange={e => setForm({...form, currentStatus: e.target.value})}>
                  <option value="student">{t("statuses.student")}</option>
                  <option value="employed">{t("statuses.employed")}</option>
                  <option value="job_seeker">{t("statuses.job_seeker")}</option>
                </select>
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.back()}>{t("cancelButton")}</Button>
            <Button type="submit" className="flex-1">{t("saveButton")}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}
