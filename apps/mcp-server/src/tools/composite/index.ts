/**
 * Tier 1 Composite Tools - Task-oriented high-level operations
 * 
 * These tools aggregate multiple API calls to deliver complete workflows
 * in a single operation. They accept natural language inputs and return
 * rich, formatted responses with recommendations.
 */

export { getAccountDashboard } from './get-account-dashboard.js';
export { findSitesWithIssues } from './find-sites-with-issues.js';
export { getSiteHealth } from './get-site-health.js';
export { searchDevices } from './search-devices.js';

// Example composite tools (for reference)
export { getDeviceHealth } from './device-health.js';
