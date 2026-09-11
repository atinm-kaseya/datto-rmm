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
    const body = JSON.parse(result.content[0]!.text);

    expect(body.ok).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.device).toBeDefined();
    expect(body.data.issue).toBe('slow performance');
    expect(body.data.findings).toBeInstanceOf(Array);
    expect(body.data.recommendations).toBeInstanceOf(Array);
  });

  it('should identify disk-related alerts in findings', async () => {
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

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.findings).toBeInstanceOf(Array);

    const findingsText = body.data.findings.join(' ');
    expect(findingsText).toContain('Disk Space');
  });

  it('should show failed jobs in findings', async () => {
    const client = createMockClient();
    const result = await diagnoseDeviceIssue(client, {
      device: 'device-1',
      issue: 'backup failing',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    // The default mock client has a failed Disk Cleanup job
    const findingsText = body.data.findings.join(' ');
    expect(findingsText).toContain('failure');
  });

  it('should provide specific action plan based on issue', async () => {
    const client = createMockClient();
    const result = await diagnoseDeviceIssue(client, {
      device: 'device-1',
      issue: 'backup failing',
    });

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.recommendations).toBeInstanceOf(Array);
    expect(body.data.recommendations.length).toBeGreaterThan(0);

    // Each recommendation has priority and action fields
    const rec = body.data.recommendations[0];
    expect(rec).toHaveProperty('priority');
    expect(rec).toHaveProperty('action');
    expect(['high', 'medium', 'low']).toContain(rec.priority);
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

    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(true);
    expect(body.data.device.online).toBe(false);
    expect(body.data.findings).toContain('Device is offline');
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
    const body = JSON.parse(result.content[0]!.text);
    expect(body.ok).toBe(false);
    expect(body.error).toBe('entity_not_found');
    expect(body.detail).toContain('Device not found');
  });
});
