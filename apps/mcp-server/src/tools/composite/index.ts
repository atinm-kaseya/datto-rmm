/**
 * Tier 1 Composite Tools - Task-oriented high-level operations
 * 
 * These tools aggregate multiple API calls to deliver complete workflows
 * in a single operation. They accept natural language inputs and return
 * rich, formatted responses with recommendations.
 */

// Phase 1: Account & Site Operations
export { getAccountDashboard } from './get-account-dashboard.js';
export { findSitesWithIssues } from './find-sites-with-issues.js';
export { getSiteHealth } from './get-site-health.js';
export { searchDevices } from './search-devices.js';

// Phase 2: Device & Alert Operations
export { getDeviceHealth } from './get-device-health.js';
export { diagnoseDeviceIssue } from './diagnose-device-issue.js';
export { investigateAlert } from './investigate-alert.js';
export { getAlertSummary } from './get-alert-summary.js';
