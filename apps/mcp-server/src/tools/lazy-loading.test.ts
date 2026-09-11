/**
 * Tests for lazy loading group metadata in tools/index.ts
 */

import { describe, it, expect } from 'vitest';
import { tools, CORE_TOOL_NAMES, LAZY_TOOL_GROUPS, getToolGroup } from './index.js';

describe('CORE_TOOL_NAMES', () => {
  it('contains rmm_load_tools', () => {
    expect(CORE_TOOL_NAMES.has('rmm_load_tools')).toBe(true);
  });

  it('contains all 13 composite tools', () => {
    const compositeTools = [
      'rmm_get_account_dashboard',
      'rmm_find_sites_with_issues',
      'rmm_search_devices',
      'rmm_get_site_health',
      'rmm_get_device_health',
      'rmm_diagnose_device_issue',
      'rmm_investigate_alert',
      'rmm_get_alert_summary',
      'rmm_list_site_devices',
      'rmm_get_site_alerts',
      'rmm_run_site_component',
      'rmm_bulk_update_site_devices',
      'rmm_get_account_analytics',
    ];
    for (const name of compositeTools) {
      expect(CORE_TOOL_NAMES.has(name), `Expected ${name} in CORE_TOOL_NAMES`).toBe(true);
    }
  });

  it('has exactly 14 entries (13 composite + rmm_load_tools)', () => {
    expect(CORE_TOOL_NAMES.size).toBe(14);
  });
});

describe('LAZY_TOOL_GROUPS', () => {
  it('has 10 groups', () => {
    expect(Object.keys(LAZY_TOOL_GROUPS)).toHaveLength(10);
  });

  it('has 44 total lazy tools', () => {
    const total = Object.values(LAZY_TOOL_GROUPS).reduce((sum, names) => sum + names.length, 0);
    expect(total).toBe(44);
  });
});

describe('getToolGroup', () => {
  it('returns the correct group for a lazy tool', () => {
    expect(getToolGroup('rmm_get_device')).toBe('devices');
    expect(getToolGroup('rmm_get_alert')).toBe('alerts');
    expect(getToolGroup('rmm_get_job')).toBe('jobs');
    expect(getToolGroup('rmm_list_activity_logs')).toBe('activity');
  });

  it('returns null for core tools', () => {
    expect(getToolGroup('rmm_get_account_dashboard')).toBeNull();
    expect(getToolGroup('rmm_load_tools')).toBeNull();
    expect(getToolGroup('rmm_get_site_health')).toBeNull();
  });

  it('returns null for unknown tool names', () => {
    expect(getToolGroup('rmm_nonexistent')).toBeNull();
  });
});

describe('tool coverage — no orphaned tools', () => {
  it('every tool in the tools array is either in CORE_TOOL_NAMES or in a LAZY_TOOL_GROUPS value', () => {
    const allLazy = new Set(Object.values(LAZY_TOOL_GROUPS).flat());
    const orphans: string[] = [];
    for (const tool of tools) {
      if (!CORE_TOOL_NAMES.has(tool.name) && !allLazy.has(tool.name)) {
        orphans.push(tool.name);
      }
    }
    expect(orphans, `Orphaned tools (not in core or any lazy group): ${orphans.join(', ')}`).toHaveLength(0);
  });

  it('total tools (58) equals CORE_TOOL_NAMES (14) + lazy (44)', () => {
    const lazyCount = Object.values(LAZY_TOOL_GROUPS).reduce((sum, names) => sum + names.length, 0);
    expect(CORE_TOOL_NAMES.size + lazyCount).toBe(58);
    expect(tools).toHaveLength(58);
  });
});
