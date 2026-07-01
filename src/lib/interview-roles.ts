/** Backend QUESTION_BANK keys — must match API `target_role`. */
export const INTERVIEW_ROLES = [
  {
    targetRole: 'Customer Support Representative',
    icon: '🎧',
    titleKey: 'roles.csr.title',
    descKey: 'roles.csr.desc',
  },
  {
    targetRole: 'IT Support',
    icon: '💻',
    titleKey: 'roles.it.title',
    descKey: 'roles.it.desc',
  },
  {
    targetRole: 'Remote Admin Assistant',
    icon: '🗂️',
    titleKey: 'roles.admin.title',
    descKey: 'roles.admin.desc',
  },
] as const;

export const DEFAULT_INTERVIEW_LEVEL = 'preparation';
