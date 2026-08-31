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
    GET: async (path: string, _options?: any) => {
      // ── Account ──────────────────────────────────────────────────────────────
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
      if (path === '/v2/account/alerts/resolved') {
        return { data: responses.resolvedAlerts, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/account/variables') {
        return { data: responses.accountVariables, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/account/users') {
        return { data: responses.users, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/account/components') {
        return { data: responses.components, error: undefined, response: mockResponse() };
      }

      // ── Single alert ──────────────────────────────────────────────────────────
      if (path === '/v2/alert/{alertUid}') {
        return {
          data: responses.alert,
          error: responses.alert ? undefined : { code: 404, message: 'Not found' },
          response: mockResponse(),
        };
      }

      // ── Single device ─────────────────────────────────────────────────────────
      if (path === '/v2/device/{deviceUid}') {
        return { data: responses.device, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/device/id/{deviceId}') {
        return { data: responses.device, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/device/macAddress/{macAddress}') {
        return { data: responses.devicesByMac, error: undefined, response: mockResponse() };
      }

      // ── Device sub-resources ──────────────────────────────────────────────────
      if (path === '/v2/device/{deviceUid}/jobs') {
        return { data: responses.deviceJobs, error: undefined, response: mockResponse() };
      }
      if (path.startsWith('/v2/device/') && path.includes('/alerts/open')) {
        return { data: responses.deviceAlerts, error: undefined, response: mockResponse() };
      }
      if (path.startsWith('/v2/device/') && path.includes('/alerts/resolved')) {
        return { data: responses.deviceResolvedAlerts, error: undefined, response: mockResponse() };
      }
      if (path.startsWith('/v2/device/') && path.includes('/patches')) {
        return { data: responses.devicePatches, error: undefined, response: mockResponse() };
      }

      // ── Audit ─────────────────────────────────────────────────────────────────
      if (path === '/v2/audit/device/{deviceUid}/software') {
        return { data: responses.deviceSoftware, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/audit/device/macAddress/{macAddress}') {
        return { data: responses.deviceAuditByMac, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/audit/device/{deviceUid}') {
        return { data: responses.deviceAudit, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/audit/esxihost/{deviceUid}') {
        return { data: responses.esxiAudit, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/audit/printer/{deviceUid}') {
        return { data: responses.printerAudit, error: undefined, response: mockResponse() };
      }

      // ── Sites ─────────────────────────────────────────────────────────────────
      if (path.startsWith('/v2/site/')) {
        if (path.includes('/devices')) {
          return { data: responses.siteDevices, error: undefined, response: mockResponse() };
        }
        if (path.includes('/alerts/open')) {
          return { data: responses.siteAlerts, error: undefined, response: mockResponse() };
        }
        if (path.includes('/alerts/resolved')) {
          return { data: responses.siteResolvedAlerts, error: undefined, response: mockResponse() };
        }
        if (path.includes('/variables')) {
          return { data: responses.siteVariables, error: undefined, response: mockResponse() };
        }
        if (path.includes('/settings')) {
          return { data: responses.siteSettings, error: undefined, response: mockResponse() };
        }
        if (path.includes('/filters')) {
          return { data: responses.siteFilters, error: undefined, response: mockResponse() };
        }
        if (path.includes('/patches')) {
          return { data: responses.sitePatches, error: undefined, response: mockResponse() };
        }
        // Default: site info
        return { data: responses.site, error: undefined, response: mockResponse() };
      }

      // ── Jobs ──────────────────────────────────────────────────────────────────
      if (path.startsWith('/v2/job/')) {
        if (path.includes('/stderr')) {
          return { data: responses.jobStderr, error: undefined, response: mockResponse() };
        }
        if (path.includes('/stdout')) {
          return { data: responses.jobStdout, error: undefined, response: mockResponse() };
        }
        if (path.includes('/results/')) {
          return { data: responses.jobResults, error: undefined, response: mockResponse() };
        }
        if (path.includes('/components')) {
          return { data: responses.jobComponents, error: undefined, response: mockResponse() };
        }
        return { data: responses.job, error: undefined, response: mockResponse() };
      }

      // ── Filters ───────────────────────────────────────────────────────────────
      if (path === '/v2/filter/default-filters') {
        return { data: responses.defaultFilters, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/filter/custom-filters') {
        return { data: responses.customFilters, error: undefined, response: mockResponse() };
      }

      // ── System ────────────────────────────────────────────────────────────────
      if (path === '/v2/system/status') {
        return { data: responses.systemStatus, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/system/request_rate') {
        return { data: responses.rateLimit, error: undefined, response: mockResponse() };
      }
      if (path === '/v2/system/pagination') {
        return { data: responses.pageMaxSettings, error: undefined, response: mockResponse() };
      }

      // ── Activity logs ─────────────────────────────────────────────────────────
      if (path === '/v2/activity-logs') {
        return { data: responses.activityLogs, error: undefined, response: mockResponse() };
      }

      // ── Metering ──────────────────────────────────────────────────────────────
      if (path === '/v2/metering/summary') {
        return { data: responses.meteringSummary, error: undefined, response: mockResponse() };
      }

      // Default: empty response
      return { data: {}, error: undefined, response: mockResponse() };
    },

    POST: async () => ({ data: {}, error: undefined, response: mockResponse() }),

    PUT: async (path: string, _options?: any) => {
      if (path === '/v2/site') {
        return { data: responses.site, error: undefined, response: mockResponse() };
      }
      if (typeof path === 'string' && path.includes('/quickjob')) {
        return { data: responses.quickJobResult, error: undefined, response: mockResponse() };
      }
      // Void PUT (variables, move device, etc.)
      return { data: {}, error: undefined, response: mockResponse() };
    },

    PATCH: async () => ({ data: {}, error: undefined, response: mockResponse() }),
    DELETE: async () => ({ data: undefined, error: undefined, response: mockResponse() }),
  } as any;
}

/**
 * Mock response types that can be customized per test.
 */
export interface MockResponses {
  // Account
  account: T.Account;
  sites: T.SitesPage;
  devices: T.DevicesPage;
  alerts: T.AlertsPage;
  resolvedAlerts: T.AlertsPage;
  accountVariables: T.VariablesPage;
  users: T.UsersPage;
  components: T.ComponentsPage;
  meteringSummary: Record<string, unknown>;

  // Alert
  alert: T.Alert | null;

  // Device
  device: T.Device;
  devicesByMac: T.Device[];
  deviceAlerts: T.AlertsPage;
  deviceResolvedAlerts: T.AlertsPage;
  deviceAudit: any;
  deviceJobs: any;

  // Audit
  deviceSoftware: T.SoftwarePage;
  deviceAuditByMac: T.DeviceAudit[];
  esxiAudit: T.ESXiHostAudit;
  printerAudit: T.PrinterAudit;

  // Site
  site: T.Site;
  siteDevices: T.DevicesPage;
  siteAlerts: T.AlertsPage;
  siteResolvedAlerts: T.AlertsPage;
  siteVariables: T.VariablesPage;
  siteSettings: T.SiteSettings;
  siteFilters: T.FiltersPage;

  // Jobs
  job: T.Job;
  jobComponents: T.JobComponentsPage;
  jobResults: T.JobResults;
  jobStdout: T.JobStdData[];
  jobStderr: T.JobStdData[];

  // Filters
  defaultFilters: T.FiltersPage;
  customFilters: T.FiltersPage;

  // System
  systemStatus: T.StatusResponse;
  rateLimit: T.RateStatusResponse;
  pageMaxSettings: T.PaginationConfiguration;

  // Activity
  activityLogs: T.ActivityLogsPage;

  // QuickJob result
  quickJobResult: T.CreateQuickJobResponse;

  // Patches
  devicePatches: { pageDetails?: any; patches?: any[] };
  sitePatches: { pageDetails?: any; patches?: any[] };
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
  resolvedAlerts: {
    pageDetails: { count: 5, prevPageUrl: undefined, nextPageUrl: undefined },
    alerts: [
      {
        alertUid: 'resolved-1',
        priority: 'High',
        diagnostics: 'High CPU: resolved',
        alertSourceInfo: {
          deviceUid: 'device-1',
          deviceName: 'web-server-01',
          siteUid: 'site-1',
          siteName: 'Acme Corp',
        },
      },
    ],
  },
  accountVariables: {
    pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
    variables: [
      { id: 10, name: 'globalServer', value: 'server01.local' },
    ],
  },
  users: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    users: [
      { id: 1, email: 'admin@test.com', firstName: 'Admin', lastName: 'User' } as any,
      { id: 2, email: 'user@test.com', firstName: 'Regular', lastName: 'User' } as any,
    ],
  },
  components: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    components: [
      { uid: 'comp-1', name: 'Disk Cleanup', id: 1 } as any,
      { uid: 'comp-2', name: 'Windows Updates', id: 2 } as any,
    ],
  },
  meteringSummary: {
    totalCalls: 1234,
    byOrigin: { mcp: 1234 },
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
  siteResolvedAlerts: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    alerts: [
      {
        alertUid: 'site-resolved-1',
        priority: 'High',
        diagnostics: 'High Memory: resolved',
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
  siteFilters: {
    pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
    filters: [
      { id: 1, name: 'Windows Servers' } as any,
    ],
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
  deviceResolvedAlerts: {
    pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
    alerts: [
      {
        alertUid: 'dev-resolved-1',
        priority: 'High',
        diagnostics: 'CPU spike: resolved',
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
    deviceClass: 'device' as const,
    operatingSystem: 'Windows Server 2022',
    intIpAddress: '192.168.1.10',
    extIpAddress: '203.0.113.10',
    domain: 'acme.local',
    lastLoggedInUser: 'admin@acme.local',
    lastSeen: new Date(Date.now() - 120000).toISOString(), // 2 min ago
  },
  devicesByMac: [
    {
      uid: 'device-1',
      hostname: 'web-server-01',
      siteName: 'Acme Corp',
      siteUid: 'site-1',
      online: true,
      deviceType: { type: 'Server' },
    },
  ],
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
  deviceSoftware: {
    pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
    software: [
      { name: 'Google Chrome', version: '120.0' } as any,
      { name: 'Microsoft Office', version: '16.0' } as any,
      { name: 'Node.js', version: '20.0' } as any,
    ],
  },
  deviceAuditByMac: [
    {
      cpu: { name: 'Intel Core i7', cores: 4 },
      memory: { totalMemory: 17179869184 },
    } as any,
  ],
  esxiAudit: {
    hostName: 'esxi-host-01',
    version: '7.0.0',
  } as any,
  printerAudit: {
    printerName: 'HP LaserJet Pro',
    model: 'LaserJet Pro M404',
  } as any,
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
  job: {
    jobUid: 'job-1',
    jobType: 'Windows Updates',
    status: 'completed',
    startTime: Date.now() - 3600000,
  } as any,
  jobComponents: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    jobComponents: [
      { componentUid: 'comp-1', status: 'completed' } as any,
      { componentUid: 'comp-2', status: 'completed' } as any,
    ],
  },
  jobResults: {
    jobUid: 'job-1',
    deviceUid: 'device-1',
    jobDeploymentStatus: 'Success',
  } as any,
  jobStdout: [
    { jobUid: 'job-1', deviceUid: 'device-1', output: 'Job completed successfully' } as any,
  ],
  jobStderr: [
    { jobUid: 'job-1', deviceUid: 'device-1', output: '' } as any,
  ],
  defaultFilters: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    filters: [
      { id: 1, name: 'All Devices' } as any,
      { id: 2, name: 'Online Devices' } as any,
    ],
  },
  customFilters: {
    pageDetails: { count: 1, prevPageUrl: undefined, nextPageUrl: undefined },
    filters: [
      { id: 10, name: 'Production Servers' } as any,
    ],
  },
  systemStatus: {
    status: 'ok',
    message: 'All systems operational',
  } as any,
  rateLimit: {
    maxCalls: 600,
    currentCalls: 42,
    period: 60,
  } as any,
  pageMaxSettings: {
    maxValue: 500,
    defaultValue: 100,
  } as any,
  activityLogs: {
    pageDetails: { count: 10, prevPageUrl: undefined, nextPageUrl: undefined },
    activities: [
      {
        id: 1,
        type: 'device',
        action: 'login',
        timestamp: new Date().toISOString(),
      } as any,
      {
        id: 2,
        type: 'user',
        action: 'password_change',
        timestamp: new Date().toISOString(),
      } as any,
    ],
  },
  quickJobResult: {
    job: {
      jobUid: 'quick-job-1',
      jobType: 'Quick Job',
      status: 'running',
    } as any,
    jobComponents: [],
  },
  devicePatches: {
    pageDetails: { count: 2, prevPageUrl: undefined, nextPageUrl: undefined },
    patches: [
      { id: 1, title: 'Security Update KB1234567', severity: 'Critical', installStatus: 'APPROVED_PENDING', kb: 'KB1234567' },
      { id: 2, title: 'Windows Feature Update', severity: 'Important', installStatus: 'INSTALLED', kb: 'KB9876543' },
    ],
  },
  sitePatches: {
    pageDetails: { count: 3, prevPageUrl: undefined, nextPageUrl: undefined },
    patches: [
      { id: 1, title: 'Security Update KB1234567', severity: 'Critical', installStatus: 'APPROVED_PENDING', kb: 'KB1234567' },
      { id: 2, title: 'Windows Feature Update', severity: 'Important', installStatus: 'INSTALLED', kb: 'KB9876543' },
      { id: 3, title: 'Driver Update', severity: 'Low', installStatus: 'NOT_APPROVED', kb: 'KB1111111' },
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
