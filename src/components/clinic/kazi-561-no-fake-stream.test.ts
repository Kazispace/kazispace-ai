import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * KAZI-561 — complete HTTP replies must not fake-typewriter.
 */
describe('KAZI-561 no fake StreamingText for complete replies', () => {
  it('useClinicChat marks complete reply streamComplete: true', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../hooks/use-clinic-chat.ts'),
      'utf8'
    );
    // After writing reply fields, the only streamComplete assignment must be true.
    expect(src).toMatch(/streamComplete:\s*true/);
    // Must not set false when persisting the full reply payload.
    const afterReply = src.slice(src.indexOf('pendingCapability: undefined'));
    expect(afterReply).toMatch(/streamComplete:\s*true/);
    expect(afterReply.slice(0, 200)).not.toMatch(/streamComplete:\s*false/);
  });

  it('MessageBubble does not import StreamingText', () => {
    const src = readFileSync(
      path.resolve(__dirname, './message-bubble.tsx'),
      'utf8'
    );
    expect(src).not.toMatch(/StreamingText/);
    expect(src).toMatch(/MarkdownContent/);
  });
});
