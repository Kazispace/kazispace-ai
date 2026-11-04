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
import { loginModeFromSearchParams } from "@/lib/login-mode";
import { useAuthStore } from "@/lib/store";

interface LoginPageProps {
  params: { locale: string };
  /** Read on the server so the first paint already has the right title (mode=signup → 注册). */
  searchParams?: { mode?: string | string[] };
}

export default function LoginPage({ params: _params, searchParams }: LoginPageProps) {
  const t = useTranslations("login");
  const router = useRouter();

  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpAttempt, setOtpAttempt] = useState<OtpAttempt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  // Which button opened the screen (kazispace-ui Homepage 0.4): "Sign up" passes mode=signup.
  // Same steps either way; only the title and the switch line differ.
  const [mode, setMode] = useState(() => loginModeFromSearchParams(searchParams));
  // True from the moment the code is accepted until this page is left (Homepage 0.4.1).
  const [entering, setEntering] = useState(false);
  const authReady = useAuthStore((s) => s.authReady);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const user = useAuthStore((s) => s.user);
  const resuming = !authReady || Boolean(isLoggedIn && user) || entering;

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

  const switchMode = () => {
    const next = mode === "signup" ? "login" : "signup";
    setMode(next);
    // Keep the URL in step (redirect and other params stay) so a reload keeps the title.
    const url = new URL(window.location.href);
    if (next === "signup") url.searchParams.set("mode", "signup");
    else url.searchParams.delete("mode");
    window.history.replaceState(window.history.state, "", url.toString());
  };

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
        setError(
          result.errorCode === "NETWORK_ERROR"
            ? t("networkError")
            : result.error || t("sendCodeFailed")
        );
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
        const search = new URLSearchParams(window.location.search);
        const redirect = search.get("redirect");
        // The session cookie is set inside verifyOtp, so the next page can start loading
        // (server render and scripts) while /me is still out (KAZI-1245 login speed-up).
        // Same rule as the navigation below, from the user verify returned: /me can only
        // refine the language, so the prefetched page is almost always the one opened.
        const likelyLocale = resolvePostLoginLocale({
          languagePreference: otpUser?.primaryLocale,
          phone: normalizedPhone,
        });
        router.prefetch(
          redirect && redirect.startsWith("/")
            ? switchLocalePath(redirect, likelyLocale)
            : `/${likelyLocale}/chat`
        );
        // The code is accepted: from here the card says the app is opening (Homepage 0.4.1).
        setEntering(true);
        // Region session already persisted inside verifyOtp (KAZI-533).
        const me = await getMe();
        const user = me.success && me.data ? me.data : otpUser;
        useAuthStore.getState().login(token, user);
        // The default chat session is needed only once a chat opens, which fetches it
        // itself if missing (ensureMasterSession): do not hold the sign-in screen for it.
        void syncMasterSession();

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
        setError(
          result.errorCode === "NETWORK_ERROR"
            ? t("networkError")
            : result.error || t("invalidCode")
        );
      }
    } catch {
      // Never leave the card on "opening" after a failure: show the form and the error.
      setEntering(false);
      setError(t("networkError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // KAZI-675: dead-centering (`items-center`) left ~250px of empty space
    // above and below the card on a typical mobile viewport height. Anchor
    // near the top on small screens instead; revert to centered from `sm:`
    // up, where a shorter/wider viewport doesn't exaggerate the gap.
    <div className="min-h-screen bg-gradient-to-br from-kazi-navy via-kazi-navy2 to-blue-950 flex items-start sm:items-center justify-center p-4 pt-12 sm:pt-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          {/* Brand logo, stacked variant for the light card (kazispace-ui decisions D10). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/kazispace-logo-stacked.png"
            alt="KaziSpace"
            width={80}
            height={96}
            className="mx-auto mb-2 h-24 w-auto"
          />
          <CardTitle className="text-xl" data-testid="login-title">
            {mode === "signup" ? t("signUpTitle") : t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessionExpired && (
            <p className="mb-4 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2 text-sm text-orange-900">
              {t("sessionExpiredContent")}
            </p>
          )}
          {resuming ? (
            <div className="flex flex-col items-center gap-3 py-8" aria-live="polite">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin" />
              {/* Signed in, the app is opening: say so instead of a bare spinner. */}
              {entering || (isLoggedIn && user) ? (
                <p className="text-sm text-workspace-secondary" data-testid="login-entering">
                  {t("entering")}
                </p>
              ) : null}
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
              <p className="text-center text-sm text-workspace-secondary" data-testid="login-switch">
                {mode === "signup" ? t("haveAccount") : t("noAccount")}{" "}
                <button type="button" onClick={switchMode} className="font-medium text-primary hover:underline">
                  {mode === "signup" ? t("switchToLogIn") : t("switchToSignUp")}
                </button>
              </p>
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
                className="w-full text-sm text-workspace-secondary hover:text-primary"
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
