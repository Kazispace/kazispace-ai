"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/lib/store";
import { useBilling } from "@/hooks/use-billing";
import { useNbaAction } from "@/hooks/use-nba-action";
import { planBadgeKey } from "@/lib/api-mappers";
import { getMe } from "@/lib/api-client";
import { syncUserLanguageCookies } from "@/lib/locale";
import { resolveMineNbaAction } from "@/lib/nba-display";
import { LogOut, ChevronRight, CreditCard, FileText, Mic, Zap, Globe, User } from "lucide-react";
import { NbaActionCard } from "@/components/nba/nba-action-card";
import { NbaActionCardSkeleton } from "@/components/nba/nba-action-card-skeleton";
import { LocaleSwitcher } from "@/components/locale/locale-switcher";

interface MinePageProps {
  params: { locale: string };
}

export default function MinePage({ params }: MinePageProps) {
  const t = useTranslations("mine");
  const tChat = useTranslations("chat");
  const router = useRouter();
  const { locale } = params;
  const { user, logout, token, isLoggedIn } = useAuthStore();
  const { balance, plan, isLoading: billingLoading } = useBilling();
  const { nba: nbaResponse, isLoading: nbaLoading } = useNbaAction();

  const displayName = user?.displayName || "Guest User";
  const displayInitial = displayName[0]?.toUpperCase() || "?";
  const badgeKey = planBadgeKey(plan);

  useEffect(() => {
    if (!isLoggedIn || !token) return;
    getMe().then((res) => {
      if (res.success && res.data) {
        useAuthStore.getState().login(token, res.data);
        syncUserLanguageCookies(res.data);
      }
    });
  }, [isLoggedIn, token]);

  const handleLogout = () => {
    if (confirm(t("logoutConfirmContent"))) {
      logout();
      router.push(`/${locale}/login`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-bg pb-20">
      <Header locale={locale} />

      <main className="pt-20 px-4 max-w-lg mx-auto space-y-6">
        {/* User Card — compact hero (~25% of prior stacked layout) */}
        <Card className="bg-gradient-to-br from-navy to-navy-2 border-0">
          <CardContent className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs leading-none mb-2">
              <Link
                href={`/${locale}/chat`}
                className="text-kazi-orange/90 hover:text-kazi-orange font-medium transition-colors shrink-0"
              >
                {tChat("backToClinic")}
              </Link>
              <Link
                href={`/${locale}/profile`}
                className="inline-flex items-center gap-0.5 text-white/50 hover:text-white/80 transition-colors shrink-0"
              >
                {t("editProfileTitle")}
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-orange to-amber-500 flex items-center justify-center text-base font-bold text-white">
                {displayInitial}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-white truncate leading-tight">
                  {displayName}
                </h2>
                <p className="text-xs text-white/60 mt-0.5 truncate">{t(badgeKey)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoggedIn && nbaLoading ? (
          <NbaActionCardSkeleton />
        ) : isLoggedIn && nbaResponse?.next_best_action ? (
          <NbaActionCard
            locale={locale}
            action={resolveMineNbaAction(nbaResponse.next_best_action, user)}
          />
        ) : null}

        {/* Credits */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-6 h-6 text-orange mx-auto mb-2" />
              <div className="text-2xl font-bold text-navy">
                {billingLoading ? "…" : (balance?.cvCredits ?? 0)}
              </div>
              <div className="text-xs text-muted">{t("cvCreditsLabel")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Mic className="w-6 h-6 text-blue mx-auto mb-2" />
              <div className="text-2xl font-bold text-navy">
                {billingLoading ? "…" : (balance?.interviewCredits ?? 0)}
              </div>
              <div className="text-xs text-muted">{t("mockInterviewsLabel")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-navy">0</div>
              <div className="text-xs text-muted">{t("streakLabel")}</div>
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
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            {t("jobPrepGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Link href={`/${locale}/cv`}>
              <Card className="hover:border-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-orange" />
                    <span className="font-medium">{t("cvRepoLabel")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <span>{t("cvRepoValue")?.split(" ")[0]}</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${locale}/interview`}>
              <Card className="hover:border-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mic className="w-5 h-5 text-blue" />
                    <span className="font-medium">{t("interviewRecordsLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Profile & Preferences */}
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            {t("profilePreferencesGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Link href={`/${locale}/profile`}>
              <Card className="hover:border-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted" />
                    <span className="font-medium">{t("targetRoleLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </CardContent>
              </Card>
            </Link>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 text-teal flex items-center justify-center font-bold text-sm">&#x2708;</div>
                  <span className="font-medium">{t("bindTelegramLabel")}</span>
                </div>
                <Badge variant="secondary">
                  {t("tgUnlinked")}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Billing & Services */}
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            {t("billingServicesGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Link href={`/${locale}/subscription`}>
              <Card className="hover:border-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-muted" />
                    <span className="font-medium">{t("subscriptionPlansLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </CardContent>
              </Card>
            </Link>
            <Link href={`/${locale}/ledger`}>
              <Card className="hover:border-orange cursor-pointer transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-muted" />
                    <span className="font-medium">{t("creditsLedgerLabel")}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted" />
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Settings */}
        <div>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            {t("systemSettingsGroupTitle")}
          </h3>
          <div className="space-y-2">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-muted" />
                  <span className="font-medium">{t("interfaceLanguageLabel")}</span>
                </div>
                <LocaleSwitcher locale={locale} />
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
