import type { CreditBalance, User } from '@/types';
import type { BillingSummary, CurrentPlan } from '@/types';

export function mapUserFromApi(raw: Record<string, unknown>): User {
  const profile = (raw.profile ?? {}) as Record<string, unknown>;
  const userId = raw.user_id ?? raw.id ?? '';

  return {
    id: String(userId),
    displayName: String(
      raw.display_name ?? profile.display_name ?? `User ${userId}`
    ),
    email: raw.email as string | undefined,
    phone: raw.phone as string | undefined,
    country: (raw.primary_country ?? profile.country) as string | undefined,
    primaryLocale: (raw.primary_locale ?? profile.primary_locale) as string | undefined,
    careerGoal: profile.career_goal as string | undefined,
    targetRole: profile.target_role as string | undefined,
    englishLevel: profile.english_level as string | undefined,
    currentStatus: profile.current_status as string | undefined,
    education: (profile.education_text ?? profile.education) as string | undefined,
    experience: (profile.experience_text ?? profile.experience) as string | undefined,
    createdAt: String(raw.first_value_at ?? raw.created_at ?? ''),
    updatedAt: String(raw.hook_state_updated_at ?? raw.updated_at ?? ''),
  };
}

export function parseCreditBalance(summary: BillingSummary): CreditBalance {
  const buckets = summary.credits?.by_bucket ?? {};
  const balance = summary.credits?.balance ?? 0;

  // Backend by_bucket keys today: free_trial, subscription, addon (no interview split yet)
  const interviewFromBucket =
    (buckets.interview as number | undefined) ??
    (buckets.mock_interview as number | undefined);

  return {
    cvCredits: balance,
    // TODO: map interview credits when backend exposes a dedicated bucket
    interviewCredits: interviewFromBucket ?? 0,
  };
}

export function planBadgeKey(plan: CurrentPlan | null): 'freeTrialBadge' | 'proBadge' | 'sprintBadge' {
  const planType = plan?.plan_type ?? '';
  if (planType.startsWith('sprint')) return 'sprintBadge';
  if (planType.includes('pro')) return 'proBadge';
  return 'freeTrialBadge';
}

/** Pro / Sprint subscribers see full IRP detail (gap list, tags, badges). */
export function isProPlan(plan: CurrentPlan | null): boolean {
  const planType = plan?.plan_type ?? '';
  return planType.includes('pro') || planType.startsWith('sprint');
}

/** CIS phone prefixes supported by backend OTP */
export const SUPPORTED_PHONE_PATTERN = /^\+(7|998|86)\d{8,12}$/;

export function isValidOtpPhone(phone: string): boolean {
  return SUPPORTED_PHONE_PATTERN.test(phone.replace(/\s/g, ''));
}
