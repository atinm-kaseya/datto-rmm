import { describe, it, expect } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { tools, CORE_TOOL_NAMES } from '../tools/index.js';

const coreManifest = tools
  .filter((t) => CORE_TOOL_NAMES.has(t.name))
  .map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));

describe('token budget', () => {
  it('core manifest covers exactly 14 tools', () => {
    expect(coreManifest).toHaveLength(14);
  });

  it('core manifest JSON size is a reasonable proxy for token count (<20KB)', () => {
    const serialized = JSON.stringify(coreManifest);
    expect(serialized.length).toBeLessThan(20_000);
  });

  it.skipIf(!process.env['ANTHROPIC_API_KEY'])(
    'core manifest stays within 1100-token budget (requires ANTHROPIC_API_KEY)',
    async () => {
      const anthropic = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

      // Count with core tools
      const withTools = await anthropic.messages.countTokens({
        model: 'claude-sonnet-4-6',
        tools: coreManifest as Anthropic.Tool[],
        messages: [{ role: 'user', content: 'hi' }],
      });

      // Count baseline (no tools) to isolate tool overhead
      const baseline = await anthropic.messages.countTokens({
        model: 'claude-sonnet-4-6',
        messages: [{ role: 'user', content: 'hi' }],
      });

      const toolTokens = withTools.input_tokens - baseline.input_tokens;

      expect(toolTokens).toBeLessThan(1100);
    },
    30_000
  );
});
