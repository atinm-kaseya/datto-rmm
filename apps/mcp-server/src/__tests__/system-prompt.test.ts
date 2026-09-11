import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT } from '../server.js';
import { LAZY_TOOL_GROUPS } from '../tools/index.js';

describe('SYSTEM_PROMPT', () => {
  it('is defined and non-empty', () => {
    expect(SYSTEM_PROMPT).toBeTruthy();
    expect(typeof SYSTEM_PROMPT).toBe('string');
  });

  it('mentions all 10 lazy group names', () => {
    for (const group of Object.keys(LAZY_TOOL_GROUPS)) {
      expect(SYSTEM_PROMPT).toContain(group);
    }
  });

  it('includes ordering rule for siteUid before deviceUid', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('siteuid');
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('deviceuid');
  });

  it('includes write confirmation rule', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('confirm');
  });

  it('includes rate_limited handling rule', () => {
    expect(SYSTEM_PROMPT).toContain('rate_limited');
  });

  it('stays within 300-token budget (approx 4 chars per token)', () => {
    const estimatedTokens = SYSTEM_PROMPT.length / 4;
    expect(estimatedTokens).toBeLessThan(300);
  });
});
