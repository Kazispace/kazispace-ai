"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { JobDetailBody } from "@/components/jobs/job-detail-body";

interface JobDetailPageProps {
  params: { locale: string; id: string };
}

export default function JobDetailPage({ params }: JobDetailPageProps) {
  const { locale, id } = params;
  const t = useTranslations("jobs");

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <main className="pt-2 pb-6 px-4 max-w-lg mx-auto">
        <Link
          href={`/${locale}/jobs`}
          className="text-sm text-primary font-medium mb-4 inline-block"
        >
          {t("backToList")}
        </Link>
        <JobDetailBody jobId={id} locale={locale} density="page" />
      </main>
    </div>
  );
}
