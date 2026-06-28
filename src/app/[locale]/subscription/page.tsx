"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

interface SubscriptionPageProps {
  params: { locale: string };
}

export default function SubscriptionPage({ params }: SubscriptionPageProps) {
  const t = useTranslations("subscription");
  const { locale } = params;
  const [tab, setTab] = useState<"pro" | "sprint" | "credits">("pro");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>
        
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab("pro")} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${tab === "pro" ? "bg-kazi-orange text-white" : "bg-white text-gray-500"}`}>
            {t("proTab")}
          </button>
          <button onClick={() => setTab("sprint")} className={`flex-1 py-2 rounded-lg font-medium transition-colors ${tab === "sprint" ? "bg-kazi-orange text-white" : "bg-white text-gray-500"}`}>
            {t("sprintTab")}
          </button>
        </div>

        {tab === "pro" && (
          <div className="space-y-4">
            <Card className="border-2 border-kazi-orange">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{t("proMonthlyName")}</h3>
                    <p className="text-3xl font-extrabold text-kazi-orange mt-1">$19<span className="text-base text-gray-500">/mo</span></p>
                  </div>
                  <Badge>{t("savePercentage")}</Badge>
                </div>
                <ul className="space-y-3 mb-6">
                  {["Unlimited Resume Generation", "Unlimited Mock Interviews", "Comprehensive 4D Diagnostic Feedback", "Advanced AI Role Rewriting"].map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full">{t("payNow")}</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "sprint" && (
          <div className="space-y-4">
            {[7, 14, 28].map((days) => (
              <Card key={days}>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold">{days}-Day Sprint</h3>
                  <p className="text-sm text-gray-500 mt-1">${days * 2} - ${days}</p>
                  <Button variant="outline" className="w-full mt-4">{t("payNow")}</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
