/**
 * Tests for rmm_diagnose_device_issue composite tool
 */

import { describe, it, expect } from 'vitest';
import { diagnoseDeviceIssue } from './diagnose-device-issue.js';
import { createMockClient } from '../../test-utils/mock-client.js';

describe('rmm_diagnose_device_issue', () => {
  it('should provide diagnostic report with action plan', async () => {
    const client = createMockClient();
    const result = await diagnoseDeviceIssue(client, {
      device: 'web-server-01',
      issue: 'slow performance',
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0]!.text;
    
    expect(text).toContain('# Diagnostic Report:');
    expect(text).toContain('**Issue:** "slow performance"');
    expect(text).toContain('## 🔍 Related Findings');
    expect(text).toContain('## 🎯 Likely Causes');
    expect(text).toContain('## 📋 Action Plan');
  });

  it('should identify disk-related alerts', async () => {
    const client = createMockClient({
      deviceAlerts: {
        pageDetails: { count: 2, totalCount: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        alerts: [
          {
            alertUid: 'a1',
            priority: 'Critical',
            diagnostics: 'Disk Space: C drive at 95%',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            alertUid: 'a2',
            priority: 'High',
            diagnostics: 'Service Down: IIS',
            timestamp: new Date(Date.now() - 1800000).toISOString(),
          },
        ],
      },
    });

    const result = await diagnoseDeviceIssue(client, {
      device: 'device-1',
      issue: 'disk space low',
    });

    const text = result.content[0]!.text;
    expect(text).toContain('Disk Space');
    expect(text).toContain('## 🔍 Related Findings');
  });

  it('should show failed jobs in history', async () => {
    const client = createMockClient();
    const result = await diagnoseDeviceIssue(client, {
      device: 'device-1',
      issue: 'backup failing',
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## 📋 Recent Job History');
  });

  it('should provide specific action plan based on issue', async () => {
    const client = createMockClient();
    const result = await diagnoseDeviceIssue(client, {
      device: 'device-1',
      issue: 'backup failing',
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## 📋 Action Plan');
    expect(text).toContain('Step 1:');
  });

  it('should handle offline devices', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [{
          uid: 'device-1',
          hostname: 'offline-server',
          siteName: 'Test Site',
          siteUid: 'site-1',
          online: false,
          deviceType: { type: 'Server' },
        }],
      },
      device: {
        uid: 'device-1',
        hostname: 'offline-server',
        siteName: 'Test Site',
        siteUid: 'site-1',
        online: false,
        deviceType: { type: 'Server' },
      },
    });

    const result = await diagnoseDeviceIssue(client, {
      device: 'offline-server',
      issue: 'not responding',
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## 🔴 Current Status');
    expect(text).toContain('**Online:** No');
    expect(text).toContain('Device is offline');
  });

  it('should handle device not found', async () => {
    const client = createMockClient({
      devices: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [],
      },
    });

    const result = await diagnoseDeviceIssue(client, {
      device: 'nonexistent',
      issue: 'test',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Device not found');
  });
});
