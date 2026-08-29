"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestOtp, verifyOtp, getMe } from "@/lib/api-client";
import { isValidOtpPhone } from "@/lib/api-mappers";
import type { OtpAttempt } from "@/lib/region";
import { getPendingOtpPhone, setPendingOtpPhone } from "@/lib/auth";
import {
  resolvePostLoginLocale,
  switchLocalePath,
  syncProfileLanguageCookie,
  readLanguagePreference,
} from "@/lib/locale";
import { syncMasterSession } from "@/lib/master-session";
import { useAuthStore } from "@/lib/store";

interface LoginPageProps {
  params: { locale: string };
}

export default function LoginPage({ params: _params }: LoginPageProps) {
  const t = useTranslations("login");
  const router = useRouter();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpAttempt, setOtpAttempt] = useState<OtpAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const authReady = useAuthStore((s) => s.authReady);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const resuming = !authReady || Boolean(isLoggedIn && user);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("expired") === "1") {
      setSessionExpired(true);
    }
    const pendingPhone = getPendingOtpPhone();
    if (pendingPhone) setPhone(pendingPhone);
  }, []);

  useEffect(() => {
    if (!authReady || !isLoggedIn || !user) return;
    const search = new URLSearchParams(window.location.search);
    const redirect = search.get("redirect");
    const targetLocale = resolvePostLoginLocale({
      languagePreference: user.primaryLocale,
      phone: user.phone ?? "",
    });
    syncProfileLanguageCookie(
      readLanguagePreference(user.primaryLocale) ?? targetLocale
    );
    const destination =
      redirect && redirect.startsWith("/")
        ? switchLocalePath(redirect, targetLocale)
        : `/${targetLocale}/chat`;
    router.replace(destination);
  }, [authReady, isLoggedIn, user, router]);

  const normalizedPhone = phone.replace(/\s/g, "");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedPhone) return;

    if (!isValidOtpPhone(normalizedPhone)) {
      setError(t("phoneInvalid"));
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const result = await requestOtp(normalizedPhone);
      if (result.success && result.attempt) {
        setPendingOtpPhone(normalizedPhone);
        setOtpAttempt(result.attempt);
        setStep("otp");
      } else if (result.success) {
        setError(t("otpRegionHostFailed"));
      } else {
        setError(result.error || t("sendCodeFailed"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;

    setIsLoading(true);
    setError("");
    try {
      const result = await verifyOtp(normalizedPhone, otp, otpAttempt);
      if (result.success && result.data) {
        const { token, user: otpUser } = result.data;
        // Region session already persisted inside verifyOtp (KAZI-533).
        const me = await getMe();
        const user = me.success && me.data ? me.data : otpUser;
        useAuthStore.getState().login(token, user);
        await syncMasterSession();

        const search = new URLSearchParams(window.location.search);
        const redirect = search.get("redirect");
        const targetLocale = resolvePostLoginLocale({
          languagePreference: user.primaryLocale,
          phone: normalizedPhone,
        });
        syncProfileLanguageCookie(
          readLanguagePreference(user.primaryLocale) ?? targetLocale
        );
        const destination =
          redirect && redirect.startsWith("/")
            ? switchLocalePath(redirect, targetLocale)
            : `/${targetLocale}/chat`;
        router.push(destination);
      } else {
        setError(result.error || t("invalidCode"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-kazi-navy via-kazi-navy2 to-blue-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="text-3xl font-bold mb-2">
            {/* Brand wordmark keeps the literal orange (UX guide Header/Hero compromise). */}
            <span className="text-kazi-brand-accent">Kazi</span>Space
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionExpired && (
            <p className="mb-4 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-sm text-orange-900">
              {t("sessionExpiredContent")}
            </p>
          )}
          {resuming ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
            </div>
          ) : step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text mb-1 block">
                  {t("phoneLabel")}
                </label>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1.5">{t("phoneHint")}</p>
                <p className="text-xs text-muted-foreground mt-1.5">{t("regionNotice")}</p>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("sending") : t("sendCode")}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text mb-1 block">
                  {t("otpLabel")}
                </label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("otpPlaceholder")}
                  className="w-full text-center text-2xl tracking-widest"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("verifying") : t("verify")}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setOtpAttempt(null);
                  setOtp("");
                  setStep("phone");
                }}
                className="w-full text-sm text-muted hover:text-primary"
              >
                {t("back")}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
