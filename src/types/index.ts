// User types
export interface User {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  country?: string;
  careerGoal?: string;
  targetRole?: string;
  englishLevel?: string;
  currentStatus?: string;
  education?: string;
  experience?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthState {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  sessionId: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// Credits types
export interface CreditBalance {
  cvCredits: number;
  interviewCredits: number;
}

export interface LedgerEntry {
  id: string;
  type: 'cv_consume' | 'interview_consume' | 'cv_recharge' | 'interview_recharge' | 'welcome_gift' | 'pro_recharge';
  amount: number;
  description?: string;
  price?: number;
  createdAt: string;
}

// Subscription types
export interface Subscription {
  plan: 'free' | 'pro' | 'sprint';
  expiresAt?: string;
  sprintDays?: number;
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface OtpRequestResponse {
  success: boolean;
  message?: string;
}

export interface OtpVerifyResponse {
  success: boolean;
  token: string;
  user: User;
}
