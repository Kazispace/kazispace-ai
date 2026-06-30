import type { SupportedLocale } from '@/lib/constants';

export type AgentStatus = 'available' | 'coming_soon';

export interface AgentRegistryEntry {
  agentId: string;
  emoji: string;
  status: AgentStatus;
  name: Record<SupportedLocale, string>;
  description: Record<SupportedLocale, string>;
  promptHint: Record<SupportedLocale, string>;
}

export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    agentId: 'job_search',
    emoji: '🎯',
    status: 'available',
    name: {
      en: 'Job Search Expert',
      ru: 'Эксперт по поиску работы',
      kk: 'Жұмыс іздеу сарапшысы',
      uz: 'Ish qidirish mutaxassisi',
    },
    description: {
      en: 'Find roles that match your profile',
      ru: 'Найди идеальную позицию',
      kk: 'Сәйкес лауазымдарды табу',
      uz: 'Mos lavozimlarni topish',
    },
    promptHint: {
      en: 'Tell me about your target role',
      ru: 'Расскажи о желаемой позиции',
      kk: 'Мақсатты лауазымыңыз туралы айтыңыз',
      uz: 'Maqsad lavozimingiz haqida ayting',
    },
  },
  {
    agentId: 'mock_interview',
    emoji: '🎤',
    status: 'available',
    name: {
      en: 'Interview Coach',
      ru: 'Тренер по собеседованиям',
      kk: 'Сұхбат жаттықтырушысы',
      uz: 'Suhbat murabbiyi',
    },
    description: {
      en: 'Practice interviews with AI feedback',
      ru: 'Пройди тренировочное собеседование',
      kk: 'ЖИ кері байланысымен жаттығу',
      uz: 'AI bilan mock suhbat',
    },
    promptHint: {
      en: 'Which role are you preparing for?',
      ru: 'Расскажи, на какую позицию готовишься',
      kk: 'Қай рөлге дайындалып жатырсыз?',
      uz: 'Qaysi rolga tayyorgarlik ko\'ryapsiz?',
    },
  },
  {
    agentId: 'career_sprint',
    emoji: '🏃',
    status: 'coming_soon',
    name: {
      en: 'Career Sprint',
      ru: 'Карьерный спринт',
      kk: 'Мансаптық спринт',
      uz: 'Karyera sprint',
    },
    description: {
      en: '2-week structured career plan',
      ru: 'Системный план за 2 недели',
      kk: '2 аптадық жоспар',
      uz: '2 haftalik reja',
    },
    promptHint: {
      en: 'Coming soon',
      ru: 'Скоро',
      kk: 'Жақында',
      uz: 'Tez orada',
    },
  },
];

export function getAgentLabel(
  agent: AgentRegistryEntry,
  locale: string,
  field: 'name' | 'description' | 'promptHint'
): string {
  const loc = locale as SupportedLocale;
  return agent[field][loc] ?? agent[field].en;
}

/** Quick-reply chips shown in expert mode (UX §3.3) */
export const AGENT_QUICK_REPLIES: Record<
  string,
  Record<SupportedLocale, string[]>
> = {
  job_search: {
    en: ['💰 Salary focus', '🌍 Remote only', '📈 Career growth', '🏢 Almaty jobs'],
    ru: ['💰 Зарплата', '🌍 Remote', '📈 Рост', '🏢 Алматы'],
    kk: ['💰 Жалақы', '🌍 Remote', '📈 Өсу', '🏢 Алматы'],
    uz: ['💰 Maosh', '🌍 Remote', '📈 O\'sish', '🏢 Olmaota'],
  },
  mock_interview: {
    en: ['Behavioral questions', 'Technical round', 'English practice'],
    ru: ['Поведенческие вопросы', 'Техническое интервью', 'Практика английского'],
    kk: ['Мінез-құлық сұрақтары', 'Техникалық сұхбат', 'Ағылшын практикасы'],
    uz: ['Xulq-atvor savollari', 'Texnik suhbat', 'Ingliz amaliyoti'],
  },
};

export function getAgentStatusBadge(
  agentId: string,
  locale: SupportedLocale
): string | null {
  // TODO: read ui.status_badge from GET /agents or GET /agents/active when backend §13 ships
  if (agentId === 'job_search') {
    const labels: Record<SupportedLocale, string> = {
      en: '🔍 12 positions found · Refresh',
      ru: '🔍 Найдено 12 вакансий · Обновить',
      kk: '🔍 12 лауазым табылды · Жаңарту',
      uz: '🔍 12 ta vakansiya · Yangilash',
    };
    return labels[locale] ?? labels.en;
  }
  return null;
}
