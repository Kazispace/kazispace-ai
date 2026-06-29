"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mic } from "lucide-react";
import Link from "next/link";
import { useBilling } from "@/hooks/use-billing";

interface CreditsPageProps {
  params: { locale: string };
}

export default function CreditsPage({ params }: CreditsPageProps) {
  const t = useTranslations("credits");
  const { locale } = params;
  const { balance, isLoading, error } = useBilling();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const total = balance?.cvCredits ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>

        {!mounted || isLoading ? (
          <p className="text-center text-gray-500 py-12">{t("loading")}</p>
        ) : error ? (
          <p className="text-center text-red-500 py-12">{t("loadError")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card>
              <CardContent className="p-6 text-center">
                <FileText className="w-8 h-8 text-kazi-orange mx-auto mb-3" />
                <div className="text-4xl font-extrabold text-kazi-navy">{total}</div>
                <div className="text-sm text-gray-500 mt-1">{t("totalCredits")}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 text-center">
                <Mic className="w-8 h-8 text-blue-500 mx-auto mb-3" />
                <div className="text-4xl font-extrabold text-kazi-navy">
                  {balance?.interviewCredits ?? 0}
                </div>
                <div className="text-sm text-gray-500 mt-1">{t("currentBalance")}</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Link href={`/${locale}/subscription`}>
          <Button className="w-full py-6">{t("buyCredits")}</Button>
        </Link>
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
