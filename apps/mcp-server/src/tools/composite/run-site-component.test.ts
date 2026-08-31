/**
 * Tests for rmm_run_site_component composite tool
 */

import { describe, it, expect } from 'vitest';
import { createMockClient } from '../../test-utils/mock-client.js';
import { runSiteComponent } from './run-site-component.js';

describe('rmm_run_site_component', () => {
  it('should create execution plan in dry-run mode', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      component: 'disk-cleanup',
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('# Component Execution Plan');
    expect(text).toContain('**Site:** Acme Corp');
    expect(text).toContain('**Component:** disk-cleanup');
    expect(text).toContain('## 🔍 Dry Run Mode');
    expect(text).toContain('No jobs will be created');
  });

  it('should handle multiple devices', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'server-01',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'server-02',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-3',
            hostname: 'server-03',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['server-01', 'server-02', 'server-03'],
      component: 'windows-updates',
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**Devices:** 3 devices');
    expect(text).toContain('server-01');
    expect(text).toContain('server-02');
    expect(text).toContain('server-03');
  });

  it('should handle "all" devices selection', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: 'all',
      component: 'component-123',
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**Devices:**');
    expect(text).toContain('device'); // Should list the devices
  });

  it('should include component variables', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      component: 'script-runner',
      variables: {
        scriptPath: '/scripts/cleanup.ps1',
        timeout: '300',
      },
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('**Variables:**');
    expect(text).toContain('scriptPath: /scripts/cleanup.ps1');
    expect(text).toContain('timeout: 300');
  });

  it('should handle device not found', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['nonexistent-device'],
      component: 'test',
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Device "nonexistent-device" not found');
  });

  it('should mark offline devices', async () => {
    const client = createMockClient({
      siteDevices: {
        pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
        devices: [
          {
            uid: 'device-1',
            hostname: 'online-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: true,
            deviceType: { type: 'Server' },
          },
          {
            uid: 'device-2',
            hostname: 'offline-server',
            siteName: 'Test Site',
            siteUid: 'site-1',
            online: false,
            deviceType: { type: 'Server' },
          },
        ],
      },
    });

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: 'all',
      component: 'test-component',
      dry_run: true,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('offline, job will queue');
    expect(text).toContain('🔴 offline-server');
    expect(text).toContain('🟢 online-server');
  });

  it('should handle site not found', async () => {
    const client = createMockClient({
      sites: {
        pageDetails: { count: 0, prevPageUrl: undefined, nextPageUrl: undefined },
        sites: [],
      },
    });

    const result = await runSiteComponent(client, {
      site: 'nonexistent',
      devices: ['device-1'],
      component: 'test',
      dry_run: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('Site not found');
  });

  it('should simulate job creation in live mode', async () => {
    const client = createMockClient();

    const result = await runSiteComponent(client, {
      site: 'Acme Corp',
      devices: ['web-server-01'],
      component: 'disk-cleanup',
      dry_run: false,
    });

    const text = result.content[0]!.text;
    expect(text).toContain('## ⚙️ Execution Status');
    expect(text).toContain('job');
    expect(text).toContain('created');
  });
});
