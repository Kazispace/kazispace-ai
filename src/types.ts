export interface TestUserProfile {
  name: string;
  role: string;
  company: string;
  skills: string[];
  fingerprint: string;
}

export interface UserAssertions {
  must_contain: string[];
  must_not_contain: string[];
}

export interface ScriptedUser {
  id: string;
  phone: string;
  device_id: string;
  profile: TestUserProfile;
  script: string[];
  assert: UserAssertions;
}

export interface StressScenario {
  scenario: string;
  api_base: string;
  agent_id: string;
  users: ScriptedUser[];
}

export interface AuthSession {
  userId: string;
  phone: string;
  deviceId: string;
  token: string;
}

export interface StepResult {
  step: number;
  message: string;
  status: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
  pipelineState?: string | null;
  cvPreview?: string | null;
}

export interface UserRunResult {
  userId: string;
  phone: string;
  sessionId?: string;
  steps: StepResult[];
  cvMarkdown?: string;
  assertionResults?: AssertionResult[];
  passed: boolean;
  errors: string[];
}

export interface AssertionResult {
  type: 'must_contain' | 'must_not_contain' | 'technical';
  field: string;
  passed: boolean;
  detail?: string;
}

export interface TestCaseResult {
  id: string;
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface TestReport {
  suite: 'function' | 'stress' | 'monkey';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  passed: boolean;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  results: TestCaseResult[];
}

export interface MonkeyEvent {
  action: string;
  endpoint: string;
  status: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}
