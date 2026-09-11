# MSP Workflows with Recommended Tools

This guide shows common day-to-day workflows for MSP technicians using the Datto RMM MCP server.

---

## 1. Start-of-Day Triage

**Goal:** Identify which sites and devices need attention today.

### Step 1: Get Account Dashboard
```
Tool: get-account-dashboard
Parameters: { time_range: "today" }
```

**What you'll get:**
- Total sites and devices
- Critical sites ranked by severity
- Alert summary (critical vs warnings)
- Recent activity and job success rates

### Step 2: Find Sites With Issues (if needed)
```
Tool: find-sites-with-issues
Parameters: { severity: "critical", sort_by: "combined" }
```

**What you'll get:**
- Sites ranked by problem severity
- Issue breakdown per site
- Common alert types
- Recommended focus areas

### Step 3: Investigate Priority Site
```
Tool: get-site-health
Parameters: { site: "Acme Corp" }
```

**What you'll get:**
- Complete site health snapshot
- Top devices with issues
- Alert summary by severity
- Network configuration and variables
- Recommended next actions

**Outcome:** You now know which sites need attention and where to focus first.

---

## 2. Site-Focused Investigation

**Goal:** Deep dive into a specific site to understand and resolve issues.

### Step 1: Review Site Health
```
Tool: get-site-health
Parameters: { site: "Acme Corp", include_device_details: false }
```

### Step 2: View Site Alerts
```
Tool: get-site-alerts
Parameters: { site: "Acme Corp", group_by: "device" }
```

**Use group_by: "device" when:** You want to see which devices have the most problems  
**Use group_by: "type" when:** You want to see which alert types are most common

### Step 3: List Devices (if needed for filtering)
```
Tool: list-site-devices
Parameters: {
  site: "Acme Corp",
  status: "offline",
  has_alerts: true
}
```

### Step 4: Check Problem Device
```
Tool: get-device-health
Parameters: { device: "web-server-01", site: "Acme Corp" }
```

**Outcome:** Complete understanding of site health and specific device issues.

---

## 3. Device Diagnostic Workflow

**Goal:** Troubleshoot a device with performance or reliability issues.

### Step 1: Get Device Health
```
Tool: get-device-health
Parameters: {
  device: "web-server-01",
  site: "Acme Corp",
  include_history: true
}
```

**What you'll get:**
- Device status and system info
- Hardware metrics (CPU, RAM, disk)
- Open alerts with timestamps
- Recent job history
- Recommended actions based on state

### Step 2: Diagnose Specific Issue
```
Tool: diagnose-device-issue
Parameters: {
  device: "web-server-01",
  site: "Acme Corp",
  issue: "slow performance"
}
```

**What you'll get:**
- Related alerts matching issue description
- Recent changes (software, config)
- Job history (successes/failures)
- Likely causes based on patterns
- Prioritized action plan
- Suggested components to run

### Step 3: Execute Remediation (if needed)
```
Tool: run-site-component
Parameters: {
  site: "Acme Corp",
  devices: ["web-server-01"],
  component: "Disk Cleanup"
}
```

**Outcome:** Device diagnosed and remediation applied.

---

## 4. Alert Management Workflow

**Goal:** Investigate and resolve alerts systematically.

### Step 1: Get Alert Summary
```
Tool: get-alert-summary
Parameters: {
  site: "Acme Corp",
  group_by: "type",
  time_range: "week"
}
```

**What you'll get:**
- Alert counts by grouping
- Trending analysis (vs previous period)
- Most affected devices/sites
- Common patterns
- Alert aging information

### Step 2: Investigate Specific Alert
```
Tool: investigate-alert
Parameters: {
  alert_uid: "alert123",
  include_similar: true
}
```

**What you'll get:**
- Alert details with device/site context
- Impact assessment
- Similar alerts on other devices (pattern detection)
- Recent events before alert fired
- Resolution suggestions
- Related job executions

### Step 3: Apply Resolution (if pattern identified)
```
Tool: run-site-component
Parameters: {
  site: "Acme Corp",
  devices: ["web-server-01", "db-server-01", "app-server-01"],
  component: "Disk Cleanup"
}
```

**Outcome:** Alerts resolved systematically, patterns identified.

---

## 5. Bulk Operations Workflow

**Goal:** Apply changes or execute jobs across multiple devices safely.

### Step 1: Identify Target Devices
```
Tool: list-site-devices
Parameters: {
  site: "Acme Corp",
  type: "server",
  status: "online"
}
```

### Step 2: Preview Bulk Changes (Dry Run)
```
Tool: bulk-update-site-devices
Parameters: {
  site: "Acme Corp",
  devices: ["web-server-01", "db-server-01", "app-server-01"],
  updates: {
    warranty: "2027-12-31",
    udf: { patchGroup: "Weekend" }
  },
  dry_run: true
}
```

**What you'll get:**
- Devices to be affected
- Changes to be made per device
- Preview without applying changes

### Step 3: Apply Changes (if preview looks good)
```
Tool: bulk-update-site-devices
Parameters: {
  site: "Acme Corp",
  devices: ["web-server-01", "db-server-01", "app-server-01"],
  updates: {
    warranty: "2027-12-31",
    udf: { patchGroup: "Weekend" }
  },
  dry_run: false
}
```

### Alternative: Run Component on Multiple Devices
```
Tool: run-site-component
Parameters: {
  site: "Acme Corp",
  devices: "all",
  component: "Windows Updates",
  schedule: "now"
}
```

**Safety Features:**
- Site-scoped (prevents cross-site accidents)
- Dry-run mode for preview
- 50-device limit per operation
- Offline device warnings

**Outcome:** Changes applied safely across multiple devices.

---

## 6. Cross-Site Device Search

**Goal:** Find a device when you don't know which site it belongs to.

### Step 1: Search Across All Sites
```
Tool: search-devices
Parameters: {
  query: "web-server",
  has_alerts: true
}
```

**What you'll get:**
- Devices matching query across all sites
- Site context for each device
- Status and alert counts
- Device and site UIDs for follow-up

### Step 2: Check Device Health (with site context)
```
Tool: get-device-health
Parameters: {
  device: "web-server-01",
  site: "Acme Corp"
}
```

**Outcome:** Device found and investigated with proper site context.

---

## 7. Reporting & Analytics Workflow

**Goal:** Generate usage reports and identify trends for capacity planning.

### Step 1: Get Account Analytics
```
Tool: get-account-analytics
Parameters: {
  time_range: "month",
  metrics: ["devices", "alerts", "jobs"]
}
```

**What you'll get:**
- Device growth trends
- Site count changes
- Alert resolution metrics (MTTR)
- Job execution statistics
- Top sites by device count
- Capacity planning insights

### Step 2: Drill Into Specific Metrics (if needed)
```
Tool: get-alert-summary
Parameters: {
  group_by: "site",
  time_range: "month"
}
```

**What you'll get:**
- Alert distribution across sites
- Trending analysis
- Pattern identification

**Outcome:** Comprehensive usage reports for stakeholders and capacity planning.

---

## Tips for Effective Workflows

### 🌟 Use Tier 1 Tools First
- Start with high-level tools (get-account-dashboard, get-site-health)
- They provide rich context and recommendations
- Natural language inputs (names, not UIDs)

### 🔧 Use Tier 2 Tools When Needed
- Granular control for specific API operations
- Edge cases Tier 1 doesn't cover
- Marked with "🔧 [Advanced]" in descriptions

### 🎯 Site-First Approach
- Most work happens within a site context
- Site-scoped operations prevent accidental cross-client changes
- Always specify site for device operations when possible

### 🔄 Follow Recommendations
- Each tool provides "Recommended actions" or "Next steps"
- Links to suggested follow-up tools
- Pre-filled parameters when possible

### 🛡️ Use Safety Features
- Dry-run mode for bulk operations (preview before apply)
- Default dry_run=true for destructive operations
- 50-device limit per bulk operation
- Offline device warnings before component execution

### 📊 Progressive Detail
- Start with summaries (dashboard, site health)
- Drill into specifics as needed (device health, alert investigation)
- Use include_device_details / include_history flags to control verbosity
