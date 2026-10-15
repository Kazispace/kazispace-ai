import { describe, expect, it } from 'vitest';
import tokens from './tokens.resolved.json';
import config from '../../tailwind.config';

// KAZI-1086: the Tailwind colours must come from the shared design tokens.
const MAPPED: Record<string, string> = {
  'primary.DEFAULT': 'color.action.primary',
  'primary.dark': 'color.action.primary-pressed',
  'kazi.navy': 'color.brand.navy',
  'kazi.navy2': 'color.navy.800',
  'kazi.brand-accent': 'color.brand.accent',
  'clinic-bubble': 'color.chat.assistant-bg',
  'agent-bubble': 'color.chat.specialist-bg',
  'user-bubble': 'color.chat.user-bg',
  'user-bubble-border': 'color.chat.user-border',
  'workspace.bg': 'color.bg.page',
  'workspace.sidebar': 'color.bg.surface',
  'workspace.panel': 'color.bg.surface',
  'workspace.header': 'color.bg.header',
  'workspace.border': 'color.border.default',
  'workspace.text': 'color.text.primary',
  'workspace.secondary': 'color.text.secondary',
  'workspace.muted': 'color.text.muted',
  'workspace.placeholder': 'color.text.placeholder',
  'workspace.hover': 'color.bg.hover',
  'workspace.active': 'color.bg.selected',
  'workspace.input': 'color.bg.surface',
  'workspace.accent': 'color.action.primary',
};

const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
const lookup = (path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], colors);

describe('design tokens → Tailwind colours', () => {
  it.each(Object.entries(MAPPED))('%s comes from %s', (twPath, tokenPath) => {
    const token = (tokens as unknown as Record<string, { value: string }>)[tokenPath];
    expect(token, `token ${tokenPath} missing from tokens.resolved.json`).toBeDefined();
    expect(token.value).toMatch(/^#[0-9A-F]{6}$/i);
    expect(lookup(twPath)).toBe(token.value);
  });
});
