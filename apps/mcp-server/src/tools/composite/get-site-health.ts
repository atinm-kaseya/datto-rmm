/**
 * Tier 1 Composite Tool: Get Site Health
 * 
 * Complete site health dashboard - primary entry point for site-focused work.
 * Shows everything you need to know about a site in one call.
 */

import type { DattoClient } from 'datto-rmm-api';
import { handleResponse, errorResult, type ToolResult } from '../../utils/response.js';
import type * as T from '../../types.js';

export interface GetSiteHealthArgs {
  /** Site identifier: name or UID */
  site: string;
  /** Include full device list vs summary */
  include_device_details?: boolean;
}

/**
 * Get comprehensive site health snapshot.
 * 
 * Aggregates data from multiple endpoints:
 * - Site details and settings
 * - Device counts and status
 * - Open alerts by severity
 * - Site variables
 * - Network configuration
 * 
 * Returns complete site overview with recommendations.
 */
export async function getSiteHealth(
  client: DattoClient,
  args: GetSiteHealthArgs
): Promise<ToolResult> {
  const { site, include_device_details = false } = args;

  try {
    // Step 1: Resolve site by name or UID
    const siteUid = await resolveSiteIdentifier(client, site);
    if (!siteUid) {
      return errorResult(`Site not found: "${site}". Try searching by exact name or UID.`);
    }

    // Step 2: Fetch all site data in parallel
    const [siteRes, devicesRes, alertsRes, variablesRes, settingsRes] = await Promise.all([
      client.GET('/v2/site/{siteUid}', {
        params: { path: { siteUid } },
      }),
      client.GET('/v2/site/{siteUid}/devices', {
        params: {
          path: { siteUid },
          query: { max: 250 },
        },
      }),
      client.GET('/v2/site/{siteUid}/alerts/open', {
        params: {
          path: { siteUid },
          query: { max: 250 },
        },
      }),
      client.GET('/v2/site/{siteUid}/variables', {
        params: {
          path: { siteUid },
          query: { max: 100 },
        },
      }),
      client.GET('/v2/site/{siteUid}/settings', {
        params: { path: { siteUid } },
      }),
    ]);

    const siteInfo = handleResponse<T.Site>(siteRes);
    const devicesData = handleResponse<T.DevicesPage>(devicesRes);
    const alertsData = handleResponse<T.AlertsPage>(alertsRes);
    const variablesData = handleResponse<T.VariablesPage>(variablesRes);
    const settings = handleResponse<T.SiteSettings>(settingsRes);

    const devices = devicesData.devices ?? [];
    const alerts = alertsData.alerts ?? [];
    const variables = variablesData.variables ?? [];

    // Aggregate device statistics
    const onlineDevices = devices.filter((d) => d.online).length;
    const offlineDevices = devices.length - onlineDevices;

    // Group devices by type
    const devicesByType = new Map<string, { online: number; offline: number }>();
    for (const device of devices) {
      const type = device.deviceType?.type ?? 'Unknown';
      const current = devicesByType.get(type) || { online: 0, offline: 0 };
      
      if (device.online) {
        current.online++;
      } else {
        current.offline++;
      }
      
      devicesByType.set(type, current);
    }

    // Alert statistics
    const criticalAlerts = alerts.filter((a) => a.priority === 'Critical').length;
    const warningAlerts = alerts.filter((a) => a.priority === 'High' || a.priority === 'Moderate').length;

    // Group alerts by type from diagnostics
    const alertsByType = new Map<string, number>();
    for (const alert of alerts) {
      const alertType = alert.diagnostics?.split(':')[0] || alert.priority || 'Unknown';
      alertsByType.set(alertType, (alertsByType.get(alertType) || 0) + 1);
    }

    // Find top devices with most alerts
    const alertsByDevice = new Map<string, number>();
    for (const alert of alerts) {
      const deviceUid = alert.alertSourceInfo?.deviceUid || 'unknown';
      alertsByDevice.set(deviceUid, (alertsByDevice.get(deviceUid) || 0) + 1);
    }

    const topDevicesWithAlerts = Array.from(alertsByDevice.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([deviceUid, alertCount]) => {
        const device = devices.find((d) => d.uid === deviceUid);
        return {
          name: device?.hostname ?? 'Unknown',
          uid: deviceUid,
          alertCount,
          online: device?.online ?? false,
        };
      });

    // Build response
    const lines: string[] = [];
    
    lines.push(`# Site Health: ${siteInfo.name ?? 'Unknown Site'}`);
    lines.push('');
    lines.push(`**Site UID:** \`${siteUid}\``);
    lines.push(`**Status:** ${siteInfo.onDemand ? '⚡ On-Demand' : '✅ Active'}`);
    lines.push('');

    // Device overview
    lines.push('## 📊 Devices');
    lines.push('');
    lines.push(`**Total:** ${devices.length} (${onlineDevices} online, ${offlineDevices} offline)`);
    lines.push('');

    if (devicesByType.size > 0) {
      lines.push('**Device Breakdown:**');
      for (const [type, counts] of Array.from(devicesByType.entries()).sort((a, b) => 
        (b[1].online + b[1].offline) - (a[1].online + a[1].offline)
      )) {
        const total = counts.online + counts.offline;
        const offlineNote = counts.offline > 0 ? `, ${counts.offline} offline` : '';
        lines.push(`- ${type}: ${total} (${counts.online} online${offlineNote})`);
      }
      lines.push('');
    }

    // Alert overview
    if (alerts.length > 0) {
      lines.push('## ⚠️  Open Alerts');
      lines.push('');
      lines.push(`**Total:** ${alerts.length} (${criticalAlerts} critical, ${warningAlerts} warnings)`);
      lines.push('');

      // Top alert types
      if (alertsByType.size > 0) {
        lines.push('**Alert Types:**');
        const topTypes = Array.from(alertsByType.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        for (const [type, count] of topTypes) {
          lines.push(`- ${type}: ${count}`);
        }
        lines.push('');
      }

      // Top devices with alerts
      if (topDevicesWithAlerts.length > 0) {
        lines.push('## 🔴 Top Devices With Alerts');
        lines.push('');
        
        topDevicesWithAlerts.forEach((device, index) => {
          const statusIcon = device.online ? '🟢' : '📵';
          lines.push(`${index + 1}. ${statusIcon} **${device.name}** - ${device.alertCount} alert${device.alertCount > 1 ? 's' : ''}`);
          lines.push(`   - Device UID: \`${device.uid}\``);
        });
        lines.push('');
      }
    } else {
      lines.push('## ✅ No Open Alerts');
      lines.push('');
    }

    // Network configuration
    if (settings.proxySettings && settings.proxySettings.host) {
      lines.push('## 🌐 Network Configuration');
      lines.push('');
      lines.push(`**Proxy:** ${settings.proxySettings.host}:${settings.proxySettings.port ?? ''} (${settings.proxySettings.type ?? 'unknown'})`);
      lines.push('');
    }

    // Site variables
    if (variables.length > 0) {
      lines.push('## 🔧 Site Variables');
      lines.push('');
      lines.push(`${variables.length} configured`);
      lines.push('');
    }

    // Device details (if requested)
    if (include_device_details && devices.length > 0) {
      lines.push('## 📋 All Devices');
      lines.push('');
      
      const sortedDevices = [...devices].sort((a, b) => {
        // Sort: offline first, then by alert count (descending), then by name
        if (a.online !== b.online) return a.online ? 1 : -1;
        
        const aAlerts = alertsByDevice.get(a.uid || '') || 0;
        const bAlerts = alertsByDevice.get(b.uid || '') || 0;
        if (aAlerts !== bAlerts) return bAlerts - aAlerts;
        
        return (a.hostname || '').localeCompare(b.hostname || '');
      });

      for (const device of sortedDevices.slice(0, 20)) {
        const statusIcon = device.online ? '🟢' : '📵';
        const deviceAlertCount = alertsByDevice.get(device.uid || '') || 0;
        const alertText = deviceAlertCount > 0 ? ` - ${deviceAlertCount} alert${deviceAlertCount > 1 ? 's' : ''}` : '';
        
        lines.push(`- ${statusIcon} **${device.hostname ?? 'Unknown'}** (${device.deviceType?.type ?? 'Unknown'})${alertText}`);
        lines.push(`  - UID: \`${device.uid}\``);
      }
      
      if (sortedDevices.length > 20) {
        lines.push('');
        lines.push(`_...and ${sortedDevices.length - 20} more devices_`);
      }
      
      lines.push('');
    }

    // Recommendations
    lines.push('## 💡 Recommended Actions');
    lines.push('');

    if (offlineDevices > 0) {
      lines.push(`1. **Check offline devices**: Use \`rmm_list_site_devices\` with status filter`);
      lines.push(`   \`\`\`json`);
      lines.push(`   { "site_uid": "${siteUid}", "status": "offline" }`);
      lines.push(`   \`\`\``);
      lines.push('');
    }

    if (topDevicesWithAlerts.length > 0 && topDevicesWithAlerts[0]) {
      lines.push(`${offlineDevices > 0 ? '2' : '1'}. **Investigate top device**: \`rmm_get_device_health\` on **${topDevicesWithAlerts[0].name}**`);
      lines.push(`   \`\`\`json`);
      lines.push(`   { "device": "${topDevicesWithAlerts[0].uid}", "site": "${siteUid}" }`);
      lines.push(`   \`\`\``);
      lines.push('');
    }

    if (criticalAlerts > 5) {
      lines.push(`${offlineDevices > 0 || topDevicesWithAlerts.length > 0 ? '3' : '1'}. **Alert analysis**: Use \`rmm_get_site_alerts\` for grouped view`);
      lines.push(`   \`\`\`json`);
      lines.push(`   { "site": "${siteUid}", "group_by": "type" }`);
      lines.push(`   \`\`\``);
      lines.push('');
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorResult(`Failed to get site health: ${message}`);
  }
}

/**
 * Resolve site identifier (name or UID) to UID.
 */
async function resolveSiteIdentifier(
  client: DattoClient,
  identifier: string
): Promise<string | null> {
  // If it looks like a UID (36 char hex-dash string), use it directly
  if (identifier.match(/^[a-f0-9-]{36}$/i)) {
    return identifier;
  }

  // Otherwise, search by name
  const response = await client.GET('/v2/account/sites', {
    params: {
      query: {
        siteName: identifier,
        max: 250,
      },
    },
  });

  if (response.error) {
    return null;
  }

  const sitesData = handleResponse<T.SitesPage>(response);
  const sites = sitesData.sites ?? [];
  
  // Look for exact match first
  const exactMatch = sites.find(
    (s) => s.name?.toLowerCase() === identifier.toLowerCase()
  );
  
  if (exactMatch?.uid) {
    return exactMatch.uid;
  }

  // Return first partial match
  return sites.length > 0 && sites[0]?.uid ? sites[0].uid : null;
}
