"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mic, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface LedgerPageProps {
  params: { locale: string };
}

export default function LedgerPage({ params }: LedgerPageProps) {
  const t = useTranslations("ledger");
  const { locale } = params;

  // Mock data
  const entries = [
    { id: 1, type: "recharge", creditType: "cv", amount: 5, detail: "CV Credits Recharge", remaining: 5, createdAt: "2026-06-28" },
    { id: 2, type: "consume", creditType: "cv", amount: -1, detail: "Resume Optimization", remaining: 5, createdAt: "2026-06-27" },
    { id: 3, type: "recharge", creditType: "interview", amount: 1, detail: "Welcome Gift Reward", remaining: 1, createdAt: "2026-06-26" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>
        
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-5 h-5 text-kazi-orange mx-auto mb-2" />
              <div className="text-2xl font-bold">{5}</div>
              <div className="text-xs text-gray-500">{t("cvCredits")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Mic className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">{1}</div>
              <div className="text-xs text-gray-500">{t("interviewCredits")}</div>
            </CardContent>
          </Card>
        </div>

        {/* Entries */}
        {entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${entry.type === "recharge" ? "bg-green-100" : "bg-red-100"}`}>
                    {entry.type === "recharge" ? (
                      <ArrowDownRight className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowUpRight className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{entry.detail}</div>
                    <div className="text-xs text-gray-500">{entry.createdAt}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${entry.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {entry.amount > 0 ? "+" : ""}{entry.amount}
                    </div>
                    <div className="text-xs text-gray-500">Balance: {entry.remaining}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {t("emptyState")}
          </div>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
