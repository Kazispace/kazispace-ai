import { redirect } from 'next/navigation';

import { buildClinicCvRailHref } from '@/lib/cv-entry';

interface CvLegacyRedirectPageProps {
  params: { locale: string };
  searchParams: Record<string, string | string[] | undefined>;
}

/** Legacy `/{locale}/cv` — always redirect to Clinic chat + CV right rail. */
export default function CvLegacyRedirectPage({
  params,
  searchParams,
}: CvLegacyRedirectPageProps) {
  const rawJobId = searchParams.job_id;
  const jobId =
    typeof rawJobId === 'string'
      ? rawJobId
      : Array.isArray(rawJobId)
        ? rawJobId[0]
        : null;
  redirect(buildClinicCvRailHref(params.locale, jobId));
}
