/**
 * Test utilities for mocking the Datto API client.
 */

import type { DattoClient } from 'datto-rmm-api';
import type * as T from '../types.js';

/**
 * Create a mock Datto API client for testing.
 * 
 * Returns a client with mock responses that can be customized per test.
 */
export function createMockClient(mockResponses: Partial<MockResponses> = {}): DattoClient {
  const responses = { ...defaultMockResponses, ...mockResponses };

  return {
    GET: async (path: string, options?: any) => {
      // Route to appropriate mock based on path
      if (path === '/v2/account') {
        return { data: responses.account, error: undefined, response: mockResponse() };
      }
      
      if (path === '/v2/account/sites') {
        return { data: responses.sites, error: undefined, response: mockResponse() };
      }
      
      if (path === '/v2/account/devices') {
        return { data: responses.devices, error: undefined, response: mockResponse() };
      }
      
      if (path === '/v2/account/alerts/open') {
        return { data: responses.alerts, error: undefined, response: mockResponse() };
      }
      
      if (path === '/v2/alert/{alertUid}') {
        return { data: responses.alert, error: responses.alert ? undefined : { code: 404, message: 'Not found' }, response: mockResponse() };
      }
      
      if (path === '/v2/device/{deviceUid}') {
        return { data: responses.device, error: undefined, response: mockResponse() };
      }
      
      if (path === '/v2/audit/device/{deviceUid}') {
        return { data: responses.deviceAudit, error: undefined, response: mockResponse() };
      }
      
      if (path === '/v2/device/{deviceUid}/jobs') {
        return { data: responses.deviceJobs, error: undefined, response: mockResponse() };
      }
      
      if (path.startsWith('/v2/site/')) {
        if (path.includes('/devices')) {
          return { data: responses.siteDevices, error: undefined, response: mockResponse() };
        }
        if (path.includes('/alerts/open')) {
          return { data: responses.siteAlerts, error: undefined, response: mockResponse() };
        }
        if (path.includes('/variables')) {
          return { data: responses.siteVariables, error: undefined, response: mockResponse() };
        }
        if (path.includes('/settings')) {
          return { data: responses.siteSettings, error: undefined, response: mockResponse() };
        }
        // Default site info
        return { data: responses.site, error: undefined, response: mockResponse() };
      }
      
      if (path.startsWith('/v2/device/') && path.includes('/alerts/open')) {
        return { data: responses.deviceAlerts, error: undefined, response: mockResponse() };
      }
      
      // Default: empty response
      return { data: {}, error: undefined, response: mockResponse() };
    },
    POST: async () => ({ data: {}, error: undefined, response: mockResponse() }),
    PUT: async () => ({ data: {}, error: undefined, response: mockResponse() }),
    PATCH: async () => ({ data: {}, error: undefined, response: mockResponse() }),
    DELETE: async () => ({ data: undefined, error: undefined, response: mockResponse() }),
  } as any;
}

/**
 * Mock response types that can be customized per test.
 */
export interface MockResponses {
  account: T.Account;
  sites: T.SitesPage;
  devices: T.DevicesPage;
  alerts: T.AlertsPage;
  alert: T.Alert | null;
  device: T.Device;
  site: T.Site;
  siteDevices: T.DevicesPage;
  siteAlerts: T.AlertsPage;
  siteVariables: T.VariablesPage;
  siteSettings: T.SiteSettings;
  deviceAlerts: T.AlertsPage;
  deviceAudit: any;
  deviceJobs: any;
}

/**
 * Default mock responses for testing.
 */
const defaultMockResponses: MockResponses = {
  account: {
    name: 'Test Account',
    uid: 'account-123',
    id: 12345,
    devicesStatus: {
      numberOfDevices: 100,
      numberOfOnlineDevices: 95,
      numberOfOfflineDevices: 5,
    },
  },
  sites: {
    pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
    sites: [
      {
        uid: 'site-1',
        name: 'Acme Corp',
        id: 101,
        devicesStatus: {
          numberOfDevices: 50,
          numberOfOnlineDevices: 48,
          numberOfOfflineDevices: 2,
        },
      },
      {
        uid: 'site-2',
        name: 'TechStart Inc',
        id: 102,
        devicesStatus: {
          numberOfDevices: 30,
          numberOfOnlineDevices: 28,
          numberOfOfflineDevices: 2,
        },
      },
      {
        uid: 'site-3',
        name: 'Legal Partners',
        id: 103,
        devicesStatus: {
          numberOfDevices: 20,
          numberOfOnlineDevices: 19,
          numberOfOfflineDevices: 1,
        },
      },
    ],
  },
  devices: {
    pageDetails: { count: 10, prevPageUrl: undefined, nextPageUrl: undefined },
    devices: [
      {
        uid: 'device-1',
        hostname: 'web-server-01',
        siteName: 'Acme Corp',
        siteUid: 'site-1',
        online: true,
        deviceType: { type: 'Server' },
        operatingSystem: 'Windows Server 2022',
        intIpAddress: '192.168.1.10',
      },
      {
        uid: 'device-2',
        hostname: 'db-server-01',
        siteName: 'Acme Corp',
        siteUid: 'site-1',
        online: true,
        deviceType: { type: 'Server' },
        operatingSystem: 'Windows Server 2019',
        intIpAddress: '192.168.1.11',
      },
    ],
  },
  alerts: {
    pageDetails: { count: 15, prevPageUrl: undefined, nextPageUrl: undefined },
    alerts: [
      {
        alertUid: 'alert-1',
        priority: 'Critical',
        diagnostics: 'Disk Space: C: drive at 95%',
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'web-server-01',
          siteUid: 'site-1',
          siteName: 'Acme Corp',
        },
      },
      {
        alertUid: 'alert-2',
        priority: 'Critical',
        diagnostics: 'Service Down: SQL Server',
        alertSourceInfo: {
          deviceUid: 'device-2',
          deviceName: 'db-server-01',
          siteUid: 'site-1',
          siteName: 'Acme Corp',
        },
      },
      {
        alertUid: 'alert-3',
        priority: 'High',
        diagnostics: 'High CPU: 85% sustained',
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'web-server-01',
          siteUid: 'site-1',
          siteName: 'Acme Corp',
        },
      },
    ],
  },
  site: {
    uid: 'site-1',
    name: 'Acme Corp',
    id: 101,
    devicesStatus: {
      numberOfDevices: 50,
      numberOfOnlineDevices: 48,
      numberOfOfflineDevices: 2,
    },
  },
  siteDevices: {
    pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
    devices: [
      {
        uid: 'device-1',
        hostname: 'web-server-01',
        online: true,
        deviceType: { type: 'Server' },
        operatingSystem: 'Windows Server 2022',
      },
      {
        uid: 'device-2',
        hostname: 'db-server-01',
        online: true,
        deviceType: { type: 'Server' },
      },
      {
        uid: 'device-3',
        hostname: 'workstation-01',
        online: false,
        deviceType: { type: 'Workstation' },
      },
    ],
  },
  siteAlerts: {
    pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
    alerts: [
      {
        alertUid: 'alert-1',
        priority: 'Critical',
        diagnostics: 'Disk Space: Low',
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'web-server-01',
        },
      },
    ],
  },
  siteVariables: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    variables: [
      { id: 1, name: 'backupServer', value: 'backup01.local' },
    ],
  },
  siteSettings: {
    proxySettings: {
      type: 'http',
      host: '10.0.1.1',
      port: 8080,
    },
  },
  deviceAlerts: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined, totalCount: 2 },
    alerts: [
      {
        alertUid: 'alert-1',
        priority: 'Critical',
      },
      {
        alertUid: 'alert-2',
        priority: 'High',
      },
    ],
  },
  alert: {
    alertUid: 'alert-1',
    priority: 'Critical',
    diagnostics: 'Disk Space: C drive at 95%',
    alertSourceInfo: {
      deviceUid: 'device-1',
      deviceName: 'web-server-01',
      siteUid: 'site-1',
      siteName: 'Acme Corp',
    },
  },
  device: {
    uid: 'device-1',
    hostname: 'web-server-01',
    siteName: 'Acme Corp',
    siteUid: 'site-1',
    online: true,
    deviceType: { type: 'Server' },
    operatingSystem: 'Windows Server 2022',
    intIpAddress: '192.168.1.10',
    extIpAddress: '203.0.113.10',
    domain: 'acme.local',
    lastLoggedInUser: 'admin@acme.local',
    lastSeen: new Date(Date.now() - 120000).toISOString(), // 2 min ago
  },
  deviceAudit: {
    cpu: {
      name: 'Intel Xeon E5-2680 v4',
      cores: 8,
    },
    memory: {
      totalMemory: 34359738368, // 32 GB in bytes
    },
    disks: [
      {
        volume: 'C:',
        capacity: 536870912000, // 500 GB in bytes
        freeSpace: 26843545600, // 25 GB free (5% remaining)
      },
      {
        volume: 'D:',
        capacity: 1073741824000, // 1 TB
        freeSpace: 644245094400, // 600 GB free (60% remaining)
      },
    ],
  },
  deviceJobs: {
    pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
    jobs: [
      {
        jobUid: 'job-1',
        jobType: 'Windows Updates',
        status: 'completed',
        startTime: Date.now() - 21600000, // 6h ago
      },
      {
        jobUid: 'job-2',
        jobType: 'Backup',
        status: 'completed',
        startTime: Date.now() - 43200000, // 12h ago
      },
      {
        jobUid: 'job-3',
        jobType: 'Disk Cleanup',
        status: 'failed',
        startTime: Date.now() - 86400000, // 24h ago
      },
    ],
  },
};

/**
 * Create a mock Response object.
 */
function mockResponse(): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url: 'https://test-api.centrastage.net/api/v2/test',
    headers: new Headers(),
  } as Response;
}
