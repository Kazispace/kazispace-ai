"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Mic } from "lucide-react";
import { useBilling } from "@/hooks/use-billing";
import { getLedger } from "@/lib/api-client";
import type { LedgerEntry } from "@/types";

interface LedgerPageProps {
  params: { locale: string };
}

export default function LedgerPage({ params }: LedgerPageProps) {
  const t = useTranslations("ledger");
  const { locale } = params;
  const { balance, isLoading: billingLoading } = useBilling();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getLedger().then((res) => {
      if (res.success && res.data) {
        setEntries(res.data.entries);
      }
      setLoaded(true);
    });
  }, []);

  const cvBalance = balance?.cvCredits ?? 0;
  const interviewBalance = balance?.interviewCredits ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="w-5 h-5 text-kazi-orange mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {billingLoading ? "…" : cvBalance}
              </div>
              <div className="text-xs text-gray-500">{t("cvCredits")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Mic className="w-5 h-5 text-blue-500 mx-auto mb-2" />
              <div className="text-2xl font-bold">
                {billingLoading ? "…" : interviewBalance}
              </div>
              <div className="text-xs text-gray-500">{t("interviewCredits")}</div>
            </CardContent>
          </Card>
        </div>

        {!loaded ? (
          <p className="text-center text-gray-500 py-12">…</p>
        ) : entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="font-medium text-sm">{entry.description ?? entry.type}</div>
                  <div className="text-xs text-gray-500">{entry.createdAt}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p className="font-medium text-kazi-navy">{t("comingSoon")}</p>
            <p className="text-sm mt-2">{t("emptyState")}</p>
          </div>
        )}
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
