/**
 * KAZI-1145 · in-progress `cv_wizard` drafts, keyed by `form_id`.
 *
 * In-memory only (⛔ no backend draft, design §2.4.3): closing the dialog —
 * or the backend re-offering the same wizard on the next collecting turn —
 * reopens it at the same step with what was typed. Cleared on submit, and
 * all of them on logout (they hold the signed-in user's resume).
 */
import type { CvWizardDraft } from '@/lib/cv-form';

const wizardDrafts = new Map<string, CvWizardDraft>();

export function readCvWizardDraft(formId: string): CvWizardDraft | undefined {
  return wizardDrafts.get(formId);
}

export function writeCvWizardDraft(formId: string, draft: CvWizardDraft): void {
  wizardDrafts.set(formId, draft);
}

export function clearCvWizardDraft(formId: string): void {
  wizardDrafts.delete(formId);
}

/** Logout: no CV form draft may outlive the session that typed it. */
export function clearAllCvWizardDrafts(): void {
  wizardDrafts.clear();
}
