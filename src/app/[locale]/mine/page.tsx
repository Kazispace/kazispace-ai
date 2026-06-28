"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { getTelegramUser, removeAuthToken } from "@/lib/auth";
import { LogOut, ChevronRight, CreditCard, FileText, Mic, Zap, Globe, Bell, User } from "lucide-react";
import { toast } from "sonner";

interface MinePageProps {
  params: { locale: string };
}

export default function MinePage({ params }: MinePageProps) {
  const t = useTranslations("mine");
  const router = useRouter();
  const { locale } = params;
  const { credits, logout } = useAuthStore();
  const tgUser = getTelegramUser();

  const handleLogout = () => {
    if (confirm(t("logoutConfirmContent"))) {
      removeAuthToken();
      logout();
      toast.success(t("logoutToast"));
      router.push(`/${locale}/login`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6">
        {/* User Card */}
        <Card className="bg-gradient-to-br from-kazi-navy to-kazi-navy2 border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-kazi-orange to-amber-500 flex items-center justify-center text-2xl font-bold text-white">
                {tgUser?.display_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">
                  {tgUser?.display_name || "Guest User"}
                </h2>
                <Badge variant="secondary" className="mt-1">
                  {t("freeTrialBadge")}
                </Badge>
              </div>
              <Link href={`/${locale}/profile`}>
                <Button variant="ghost" size="icon" className="text-white/70">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Credits */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-6 h-6 text-kazi-orange mx-auto mb-2" />
              <div className="text-2xl font-bold text-kazi-navy">{credits ?? 3}</div>
              <div className="text-xs text-gray-500">{t("cvCreditsLabel")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Mic className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-kazi-navy">{credits ?? 1}</div>
              <div className="text-xs text-gray-500">{t("mockInterviewsLabel")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <div className="text-2xl font-bold text-kazi-navy">0</div>
              <div className="text-xs text-gray-500">{t("streakLabel")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Upgrade Button */}
        <Link href={`/${locale}/subscription`}>
          <Button className="w-full py-6 text-lg font-semibold">
            {t("upgradeButton")}
          </Button>
        </Link>

        {/* Prep & Learn */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t("jobPrepGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Link href={`/${locale}/chat`}>
              <Card className="hover:border-kazi-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-kazi-orange" />
                    <span className="font-medium">{t("cvRepoLabel")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{t("cvRepoValue")?.split(" ")[0]}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${locale}/chat`}>
              <Card className="hover:border-kazi-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-blue-500" />
                    <span className="font-medium">{t("interviewRecordsLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Profile & Preferences */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t("profilePreferencesGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Link href={`/${locale}/profile`}>
              <Card className="hover:border-kazi-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{t("targetRoleLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-sky-500 flex items-center justify-center font-bold text-sm">✈</div>
                  <span className="font-medium">{t("bindTelegramLabel")}</span>
                </div>
                <Badge variant={tgUser ? "default" : "secondary"}>
                  {tgUser ? t("tgLinked") : t("tgUnlinked")}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Billing & Services */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t("billingServicesGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Link href={`/${locale}/subscription`}>
              <Card className="hover:border-kazi-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{t("subscriptionPlansLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${locale}/ledger`}>
              <Card className="hover:border-kazi-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-gray-400" />
                    <span className="font-medium">{t("creditsLedgerLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Settings */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t("systemSettingsGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{t("interfaceLanguageLabel")}</span>
                </div>
                <span className="text-sm text-gray-500 uppercase">{locale}</span>
              </CardContent>
            </Card>
            <button onClick={handleLogout} className="w-full">
              <Card className="hover:border-red-300 cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center gap-3 text-red-500">
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">{t("logoutLabel")}</span>
                </CardContent>
              </Card>
            </button>
          </div>
        </div>
      </main>

      <BottomNav locale={locale} />
    </div>
  );
}
