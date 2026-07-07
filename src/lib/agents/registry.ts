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
      zh: '求职专家',
    },
    description: {
      en: 'Find roles that match your profile',
      ru: 'Найди идеальную позицию',
      kk: 'Сәйкес лауазымдарды табу',
      uz: 'Mos lavozimlarni topish',
      zh: '匹配你背景的岗位',
    },
    promptHint: {
      en: 'Tell me about your target role',
      ru: 'Расскажи о желаемой позиции',
      kk: 'Мақсатты лауазымыңыз туралы айтыңыз',
      uz: 'Maqsad lavozimingiz haqida ayting',
      zh: '说说你的目标岗位',
    },
  },
  {
    agentId: 'cv_builder',
    emoji: '📄',
    status: 'available',
    name: {
      en: 'CV Builder',
      ru: 'Конструктор резюме',
      kk: 'Түйіндеме құрастырушы',
      uz: 'Rezyume yaratuvchi',
      zh: '简历助手',
    },
    description: {
      en: 'Build and polish your resume with AI',
      ru: 'Создай и улучши резюме с ИИ',
      kk: 'ЖИ көмегімен түйіндеме жасау',
      uz: 'AI bilan rezyumeni yaratish',
      zh: '用 AI 打造专业简历',
    },
    promptHint: {
      en: 'Tell me about your experience or target role',
      ru: 'Расскажи об опыте или желаемой роли',
      kk: 'Тәжірибе немесе мақсатты рөл туралы айтыңыз',
      uz: 'Tajriba yoki maqsad rol haqida ayting',
      zh: '介绍你的经历或目标岗位',
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
      zh: '面试教练',
    },
    description: {
      en: 'Practice interviews with AI feedback',
      ru: 'Пройди тренировочное собеседование',
      kk: 'ЖИ кері байланысымен жаттығу',
      uz: 'AI bilan mock suhbat',
      zh: 'AI 模拟面试与反馈',
    },
    promptHint: {
      en: 'Which role are you preparing for?',
      ru: 'Расскажи, на какую позицию готовишься',
      kk: 'Қай рөлге дайындалып жатырсыз?',
      uz: "Qaysi rolga tayyorgarlik ko'ryapsiz?",
      zh: '你在准备什么岗位的面试？',
    },
  },
  {
    agentId: 'english_tutor',
    emoji: '🗣️',
    status: 'available',
    name: {
      en: 'English Coach',
      ru: 'Тренер по английскому',
      kk: 'Ағылшын жаттықтырушысы',
      uz: 'Ingliz murabbiyi',
      zh: '英语教练',
    },
    description: {
      en: 'Career English passport & workplace practice',
      ru: 'Паспорт английского и практика для работы',
      kk: 'Мансаптық ағылшын паспорты мен практика',
      uz: 'Karyera ingliz pasporti va amaliyot',
      zh: '职场英语护照与实战练习',
    },
    promptHint: {
      en: 'Practice English for your career goals',
      ru: 'Потренируй английский для карьеры',
      kk: 'Мансап үшін ағылшын жаттығыңыз',
      uz: 'Karyera uchun ingliz mashq qiling',
      zh: '为职业目标练习英语',
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
      zh: '职业冲刺',
    },
    description: {
      en: '2-week structured career plan',
      ru: 'Системный план за 2 недели',
      kk: '2 аптадық жоспар',
      uz: '2 haftalik reja',
      zh: '两周结构化职业规划',
    },
    promptHint: {
      en: 'Coming soon',
      ru: 'Скоро',
      kk: 'Жақында',
      uz: 'Tez orada',
      zh: '即将上线',
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
    zh: ['💰 薪资优先', '🌍 只要远程', '📈 职业发展', '🏢 阿拉木图'],
  },
  mock_interview: {
    en: ['Behavioral questions', 'Technical round', 'English practice'],
    ru: ['Поведенческие вопросы', 'Техническое интервью', 'Практика английского'],
    kk: ['Мінез-құлық сұрақтары', 'Техникалық сұхбат', 'Ағылшын практикасы'],
    uz: ['Xulq-atvor savollari', 'Texnik suhbat', 'Ingliz amaliyoti'],
    zh: ['行为面试', '技术面试', '英语练习'],
  },
  english_tutor: {
    en: ['Quick 5-min test', 'Workplace speaking', 'View my passport'],
    ru: ['Быстрый тест 5 мин', 'Рабочий разговор', 'Мой паспорт'],
    kk: ['5 минуттық тест', 'Жұмыс сөйлесуі', 'Паспортым'],
    uz: ['5 daqiqalik test', 'Ish suhbati', 'Pasportim'],
    zh: ['5分钟快测', '职场口语', '查看护照'],
  },
  cv_builder: {
    en: ['Add work experience', 'Tailor for a job', 'Improve summary'],
    ru: ['Добавить опыт', 'Под вакансию', 'Улучшить summary'],
    kk: ['Жұмыс тәжірибесін қосу', 'Вакансияға бейімдеу', 'Summary жақсарту'],
    uz: ['Ish tajribasini qo\'shish', 'Vakansiyaga moslash', 'Summary yaxshilash'],
    zh: ['添加工作经历', '针对岗位优化', '改进摘要'],
  },
};

export function getAgentStatusBadge(
  agentId: string,
  locale: SupportedLocale
): string | null {
  if (agentId === 'job_search') {
    const labels: Record<SupportedLocale, string> = {
      en: '🔍 12 positions found · Refresh',
      ru: '🔍 Найдено 12 вакансий · Обновить',
      kk: '🔍 12 лауазым табылды · Жаңарту',
      uz: '🔍 12 ta vakansiya · Yangilash',
      zh: '🔍 找到 12 个岗位 · 刷新',
    };
    return labels[locale] ?? labels.en;
  }
  return null;
}
