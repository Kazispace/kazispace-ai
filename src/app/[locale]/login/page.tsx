"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { setAuthToken } from "@/lib/auth";
import { toast } from "sonner";

interface LoginPageProps {
  params: { locale: string };
}

export default function LoginPage({ params }: LoginPageProps) {
  const t = useTranslations("login");
  const router = useRouter();
  const { locale } = params;
  
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) {
      toast.error(t("error.invalidContact"));
      return;
    }
    
    setIsLoading(true);
    try {
      await apiClient.requestOtp(contact);
      setStep("otp");
      toast.success("Verification code sent!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send code");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error(t("error.invalidCode"));
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await apiClient.verifyOtp(contact, otp);
      setAuthToken(response.access_token);
      toast.success("Logged in successfully!");
      router.push(`/${locale}/mine`);
    } catch (error: any) {
      toast.error(error.message || t("error.invalidCode"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-kazi-navy via-kazi-navy2 to-blue-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="text-3xl font-bold mb-2">
            <span className="text-kazi-orange">Kazi</span>Space
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("phoneOrEmail")}
                </label>
                <Input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t("phonePlaceholder")}
                  className="w-full"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : t("sendCode")}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {t("verificationCode")}
                </label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder={t("codePlaceholder")}
                  className="w-full text-center text-2xl tracking-widest"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying..." : t("verify")}
              </Button>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="w-full text-sm text-gray-500 hover:text-kazi-orange"
              >
                ← {t("resendCode")}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
