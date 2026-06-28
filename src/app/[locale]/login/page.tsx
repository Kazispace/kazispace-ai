"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requestOtp, verifyOtp } from "@/lib/api-client";
import { useAuthStore } from "@/lib/store";

interface LoginPageProps {
  params: { locale: string };
}

export default function LoginPage({ params }: LoginPageProps) {
  const t = useTranslations("login");
  const router = useRouter();
  const { locale } = params;
  const { login } = useAuthStore();
  
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [contact, setContact] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) return;
    
    setIsLoading(true);
    setError("");
    try {
      const result = await requestOtp(contact);
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
      const result = await verifyOtp(contact, otp);
      if (result.success && result.data) {
        login(result.data.token, result.data.user);
        router.push(`/${locale}/mine`);
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
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text mb-1 block">
                  Phone or Email
                </label>
                <Input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Enter phone or email"
                  className="w-full"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-text mb-1 block">
                  Verification Code
                </label>
                <Input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-widest"
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("phone")}
                className="w-full text-sm text-muted hover:text-orange"
              >
                ← Back
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
