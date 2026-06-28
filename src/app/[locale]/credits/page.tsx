"use client";

import { useTranslations } from "next-intl";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mic } from "lucide-react";
import Link from "next/link";

interface CreditsPageProps {
  params: { locale: string };
}

export default function CreditsPage({ params }: CreditsPageProps) {
  const t = useTranslations("credits");
  const { locale } = params;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-kazi-navy mb-6">{t("title")}</h1>
        
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="w-8 h-8 text-kazi-orange mx-auto mb-3" />
              <div className="text-4xl font-extrabold text-kazi-navy">3</div>
              <div className="text-sm text-gray-500 mt-1">{t("currentBalance")}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Mic className="w-8 h-8 text-blue-500 mx-auto mb-3" />
              <div className="text-4xl font-extrabold text-kazi-navy">1</div>
              <div className="text-sm text-gray-500 mt-1">{t("currentBalance")}</div>
            </CardContent>
          </Card>
        </div>

        <Link href={`/${locale}/subscription`}>
          <Button className="w-full py-6">{t("buyCredits")}</Button>
        </Link>
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
