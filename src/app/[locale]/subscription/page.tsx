"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { planBadgeKey } from "@/lib/api-mappers";

interface SubscriptionPageProps {
  params: { locale: string };
}

export default function SubscriptionPage({ params }: SubscriptionPageProps) {
  const t = useTranslations("billing");
  const tMine = useTranslations("mine");
  const { locale } = params;
  const [tab, setTab] = useState<"pro" | "sprint">("pro");
  const { plan, isLoading } = useBilling();
  const badgeKey = planBadgeKey(plan);

  const proFeatures = [
    t("proFeature1"),
    t("proFeature2"),
    t("proFeature3"),
    t("proFeature4"),
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-kazi-navy">{t("subscriptionTitle")}</h1>
          {!isLoading && (
            <Badge variant="secondary">{tMine(badgeKey)}</Badge>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setTab("pro")}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              tab === "pro" ? "bg-primary text-white" : "bg-white text-gray-500"
            }`}
          >
            {t("proTab")}
          </button>
          <button
            type="button"
            onClick={() => setTab("sprint")}
            className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
              tab === "sprint" ? "bg-primary text-white" : "bg-white text-gray-500"
            }`}
          >
            {t("sprintTab")}
          </button>
        </div>

        {tab === "pro" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t("proTabDesc")}</p>
            <Card className="border-2 border-primary">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold">{t("proMonthlyName")}</h3>
                    <p className="text-3xl font-extrabold text-primary mt-1">
                      $19<span className="text-base text-gray-500">/mo</span>
                    </p>
                  </div>
                  <Badge>{t("savePercentage")}</Badge>
                </div>
                <ul className="space-y-3 mb-6">
                  {proFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0" /> {feature}
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
            <p className="text-sm text-gray-600">{t("sprintTabDesc")}</p>
            {[
              { days: 7, name: t("sprint7dName"), desc: t("sprint7dDesc") },
              { days: 14, name: t("sprint14dName"), desc: t("sprint14dDesc") },
              { days: 28, name: t("sprint28dName"), desc: t("sprint28dDesc") },
            ].map(({ days, name, desc }) => (
              <Card key={days}>
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold">{name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{desc}</p>
                  <Button variant="outline" className="w-full mt-4">
                    {t("payNow")}
                  </Button>
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
