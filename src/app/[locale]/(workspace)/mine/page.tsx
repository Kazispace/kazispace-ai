"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { LogOut, ChevronRight, CreditCard, FileText, Mic, Zap, Globe, Languages, User, Wallet } from "lucide-react";
import { NbaActionCard } from "@/components/nba/nba-action-card";
import { NbaActionCardSkeleton } from "@/components/nba/nba-action-card-skeleton";
import { LocaleSwitcher } from "@/components/locale/locale-switcher";

interface MinePageProps {
  params: { locale: string };
}

export default function MinePage({ params }: MinePageProps) {
  const t = useTranslations("mine");
  const tChat = useTranslations("chat");
  const tNav = useTranslations("nav");
  const tProfile = useTranslations("profile");
  const router = useRouter();
  const { locale } = params;
  const { user, logout, token, isLoggedIn } = useAuthStore();
  const { balance, plan, isLoading: billingLoading } = useBilling();
  const { nba: nbaResponse, isLoading: nbaLoading } = useNbaAction();

  const displayName = user?.displayName || "Guest User";
  const displayInitial = displayName[0]?.toUpperCase() || "?";
  const badgeKey = planBadgeKey(plan);
  const ENGLISH_LEVELS = ["beginner", "intermediate", "advanced", "fluent"];
  const englishLevelValue =
    user?.englishLevel && ENGLISH_LEVELS.includes(user.englishLevel)
      ? tProfile(`englishLevels.${user.englishLevel}`)
      : undefined;

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
    // Me is a top-level destination inside the workspace shell (kazispace-ui D2):
    // the icon rail / bottom tab bar replace the retired navy header + bottom nav.
    <div className="h-full overflow-y-auto bg-gray-bg">
      <main className="py-6 px-4 max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-workspace-text">{tNav("me")}</h1>
        {/* User Card — compact hero (~25% of prior stacked layout) */}
        <Card className="bg-gradient-to-br from-kazi-navy to-kazi-navy2 border-0">
          <CardContent className="px-4 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs leading-none mb-2">
              <Link
                href={`/${locale}/chat`}
                className="text-primary/90 hover:text-primary font-medium transition-colors shrink-0"
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
              <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-base font-bold text-white">
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
              <FileText className="w-6 h-6 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-kazi-navy">
                {billingLoading ? "…" : (balance?.cvCredits ?? 0)}
              </div>
              <div className="text-xs text-workspace-secondary">{t("cvCreditsLabel")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Mic className="w-6 h-6 text-blue mx-auto mb-2" />
              <div className="text-2xl font-bold text-kazi-navy">
                {billingLoading ? "…" : (balance?.interviewCredits ?? 0)}
              </div>
              <div className="text-xs text-workspace-secondary">{t("mockInterviewsLabel")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Zap className="w-6 h-6 text-green mx-auto mb-2" />
              <div className="text-2xl font-bold text-kazi-navy">0</div>
              <div className="text-xs text-workspace-secondary">{t("streakLabel")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Upgrade Button */}
        <Link href={`/${locale}/subscription`}>
          <Button className="w-full py-6 text-lg font-semibold">
            {t("upgradeButton")}
          </Button>
        </Link>

        {/* Me, grouped as kazispace-ui D23 sets out: profile, settings, payments,
            linked accounts, then sign out. Resumes and interview records are in Studio. */}
        <MeGroup title={t("profilePreferencesGroupTitle")}>
          <MeLinkRow
            href={`/${locale}/profile`}
            icon={<User className="w-5 h-5 text-workspace-secondary" />}
            label={t("targetRoleLabel")}
            value={user?.targetRole}
          />
          <MeLinkRow
            href={`/${locale}/profile`}
            icon={<Languages className="w-5 h-5 text-workspace-secondary" />}
            label={tProfile("englishLevelLabel")}
            value={englishLevelValue}
          />
        </MeGroup>

        <MeGroup title={t("systemSettingsGroupTitle")}>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-workspace-secondary" />
                <span className="font-medium">{t("interfaceLanguageLabel")}</span>
              </div>
              <LocaleSwitcher locale={locale} />
            </CardContent>
          </Card>
        </MeGroup>

        <MeGroup title={t("billingServicesGroupTitle")}>
          <MeLinkRow
            href={`/${locale}/ledger`}
            icon={<Wallet className="w-5 h-5 text-workspace-secondary" />}
            label={t("creditsLedgerLabel")}
          />
          <MeLinkRow
            href={`/${locale}/subscription`}
            icon={<CreditCard className="w-5 h-5 text-workspace-secondary" />}
            label={t("subscriptionPlansLabel")}
          />
        </MeGroup>

        <MeGroup title={t("linkedAccountsGroupTitle")}>
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
        </MeGroup>

        <button onClick={handleLogout} className="w-full">
          <Card className="hover:border-red-300 cursor-pointer transition-colors">
            <CardContent className="p-4 flex items-center gap-3 text-red-500">
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t("logoutLabel")}</span>
            </CardContent>
          </Card>
        </button>
      </main>
    </div>
  );
}

function MeGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-workspace-secondary uppercase tracking-wide mb-3">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** A settings row: label on the left, current value on the right (pattern "Me"). */
function MeLinkRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  value?: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-primary cursor-pointer transition-colors">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon}
            <span className="font-medium">{label}</span>
          </div>
          <div className="flex min-w-0 items-center gap-2 text-sm text-workspace-secondary">
            {value ? <span className="truncate">{value}</span> : null}
            <ChevronRight className="w-4 h-4 shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
