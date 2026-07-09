"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestOtp, verifyOtp, getMe } from "@/lib/api-client";
import { isValidOtpPhone } from "@/lib/api-mappers";
import { setAuthToken } from "@/lib/auth";
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

export default function LoginPage({ params }: LoginPageProps) {
  const t = useTranslations("login");
  const router = useRouter();
  const { locale } = params;

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get("expired") === "1") {
      setSessionExpired(true);
    }
  }, []);

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
      if (result.success) {
        setStep("otp");
      } else {
        setError(result.error || "Failed to send code");
      }
    } catch {
      setError("Network error");
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
      const result = await verifyOtp(normalizedPhone, otp);
      if (result.success && result.data) {
        const { token, user: otpUser } = result.data;
        setAuthToken(token);
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
        setError(result.error || "Invalid code");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-navy-2 to-blue-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="text-3xl font-bold mb-2">
            <span className="text-orange">Kazi</span>Space
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {sessionExpired && (
            <p className="mb-4 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-sm text-orange-900">
              {t("sessionExpiredContent")}
            </p>
          )}
          {step === "phone" ? (
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
                onClick={() => setStep("phone")}
                className="w-full text-sm text-muted hover:text-orange"
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
