"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { JobDetailBody } from "@/components/jobs/job-detail-body";

interface JobDetailPageProps {
  params: { locale: string; id: string };
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const { locale, id } = params;
  const t = useTranslations("jobs");

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Header locale={locale} />
      <main className="pt-20 px-4 max-w-lg mx-auto">
        <Link
          href={`/${locale}/jobs`}
          className="text-sm text-primary font-medium mb-4 inline-block"
        >
          {t("backToList")}
        </Link>
        <JobDetailBody jobId={id} locale={locale} density="page" />
      </main>
      <BottomNav locale={locale} />
    </div>
  );
}
