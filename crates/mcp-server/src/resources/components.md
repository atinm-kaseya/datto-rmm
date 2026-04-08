# Component Catalog

Available Datto RMM components with use cases and best practices.

---

## Maintenance Components

### Disk Cleanup
**Purpose:** Free up disk space by removing temporary files and caches  
**Best For:** Disk space alerts, routine maintenance  
**Precautions:** Review what will be deleted, ensure no critical temp files  
**Typical Runtime:** 5-15 minutes

**When to Use:**
- Disk space >80% full
- Before major updates or installations
- Monthly routine maintenance

### Clear Windows Update Cache
**Purpose:** Remove corrupt or outdated Windows Update files  
**Best For:** Update failures, disk space recovery  
**Precautions:** Will require updates to re-download  
**Typical Runtime:** 2-5 minutes

**When to Use:**
- Windows Update errors
- After failed update installations
- Disk space critical and updates cached

### Clear Temp Files
**Purpose:** Remove user and system temporary files  
**Best For:** Disk space recovery, performance issues  
**Precautions:** May affect running applications  
**Typical Runtime:** 3-10 minutes

**When to Use:**
- Disk space >85% full
- Applications reporting temp file issues
- Weekly routine cleanup

---

## Diagnostic Components

### Get Top Processes
**Purpose:** Identify processes consuming most CPU  
**Best For:** High CPU troubleshooting  
**Precautions:** Snapshot in time, may need multiple runs  
**Typical Runtime:** <1 minute

**When to Use:**
- CPU above 80% sustained
- Performance degradation
- Identifying runaway processes

### Get Top Memory Consumers
**Purpose:** Identify processes using most memory  
**Best For:** Memory exhaustion troubleshooting  
**Precautions:** Snapshot in time, check multiple times  
**Typical Runtime:** <1 minute

**When to Use:**
- Memory usage >90%
- Applications crashing with memory errors
- System swapping excessively

### Disk Usage Report
**Purpose:** Analyze disk space usage by folder  
**Best For:** Identifying space consumers  
**Precautions:** Can be slow on large drives  
**Typical Runtime:** 5-30 minutes (depends on drive size)

**When to Use:**
- Disk space critical but source unknown
- Planning data archival
- Capacity planning

### Network Diagnostics
**Purpose:** Test network connectivity and performance  
**Best For:** Network troubleshooting  
**Precautions:** May fail if network completely down  
**Typical Runtime:** 2-5 minutes

**When to Use:**
- Network connectivity issues
- Slow network performance
- DNS resolution problems

### Get Service Status
**Purpose:** Report status of Windows services  
**Best For:** Service troubleshooting  
**Precautions:** None  
**Typical Runtime:** <1 minute

**When to Use:**
- Service down alerts
- Application unavailable
- Checking service dependencies

---

## Remediation Components

### Restart RMM Agent
**Purpose:** Restart the Datto RMM agent service  
**Best For:** Agent connectivity issues  
**Precautions:** Brief disconnection from RMM  
**Typical Runtime:** <1 minute

**When to Use:**
- Agent offline or not reporting
- Agent stuck or unresponsive
- After agent configuration changes

### Restart Service
**Purpose:** Restart a specified Windows service  
**Best For:** Service failures, hangs  
**Precautions:** Service will be briefly unavailable  
**Typical Runtime:** <1 minute

**When to Use:**
- Service down or hung
- Memory leaks requiring restart
- After service configuration changes

### Close Open Files
**Purpose:** Close file handles for specified files  
**Best For:** File lock issues  
**Precautions:** May affect running applications  
**Typical Runtime:** <1 minute

**When to Use:**
- Backup failures due to locked files
- File delete/move operations failing
- Application leaving files open

### Repair Windows Update Services
**Purpose:** Reset and repair Windows Update components  
**Best For:** Persistent update failures  
**Precautions:** Will restart update services  
**Typical Runtime:** 3-5 minutes

**When to Use:**
- Update errors persist after cache clear
- Update services not starting
- Update database corruption

---

## Software Management

### Install Windows Updates
**Purpose:** Download and install available Windows updates  
**Best For:** Routine patching  
**Precautions:** May require reboot, can take hours  
**Typical Runtime:** 30 minutes - 4 hours

**When to Use:**
- Monthly patching schedules
- Critical security updates available
- Systems missing important updates

### Install Application
**Purpose:** Silent install of specified application  
**Best For:** Software deployment  
**Precautions:** Ensure correct installer and parameters  
**Typical Runtime:** 5-30 minutes (depends on app)

**When to Use:**
- Deploying standard applications
- Updating software across multiple devices
- Remote software installation

### Uninstall Application
**Purpose:** Remove specified application  
**Best For:** Software removal  
**Precautions:** Ensure application not in use  
**Typical Runtime:** 3-10 minutes

**When to Use:**
- Removing unwanted software
- Cleaning up after testing
- Security remediation (removing vulnerable apps)

---

## Security Components

### Run Antivirus Scan
**Purpose:** Execute on-demand antivirus scan  
**Best For:** Security checks, incident response  
**Precautions:** High CPU usage, can be slow  
**Typical Runtime:** 30 minutes - 4 hours

**When to Use:**
- Security incident suspected
- Scheduled security scans
- After infection removal verification

### Update Antivirus Definitions
**Purpose:** Force update of AV signature database  
**Best For:** Ensuring current protection  
**Precautions:** Requires network connectivity  
**Typical Runtime:** 1-5 minutes

**When to Use:**
- Before running virus scans
- After network outage restored
- When definitions outdated

### Check Firewall Status
**Purpose:** Verify Windows Firewall configuration  
**Best For:** Security auditing  
**Precautions:** None  
**Typical Runtime:** <1 minute

**When to Use:**
- Security compliance checks
- Troubleshooting connectivity
- After security policy changes

---

## System Management

### Reboot System
**Purpose:** Restart the computer  
**Best For:** Applying updates, clearing issues  
**Precautions:** Will disconnect users, stop services  
**Typical Runtime:** 2-5 minutes

**When to Use:**
- After Windows Updates installation
- Clearing memory leaks
- Resolving performance issues
- Schedule during maintenance windows

### Shutdown System
**Purpose:** Power down the computer  
**Best For:** Scheduled maintenance  
**Precautions:** System will be offline, schedule carefully  
**Typical Runtime:** 1-3 minutes

**When to Use:**
- Planned maintenance windows
- Hardware maintenance preparation
- Energy saving during extended downtime

---

## Best Practices

### Component Selection
- Use diagnostic components before remediation
- Verify issue persists before running component
- Check component run history to avoid duplicates
- Use dry_run when available for preview

### Scheduling
- Schedule disruptive components during maintenance windows
- Avoid running heavy components during business hours
- Stagger bulk operations across site devices
- Plan for sequential operations (diagnose → fix → verify)

### Bulk Operations
- Test on single device before bulk execution
- Use device filters to target specific groups
- Limit concurrent executions to avoid overload
- Monitor execution results and handle failures

### Safety
- Always use dry_run for bulk updates
- Get approval for disruptive operations
- Have rollback plan for configuration changes
- Test components in development before production

### Documentation
- Document custom components clearly
- Maintain component run logs
- Track success rates and typical runtimes
- Share resolution patterns with team
