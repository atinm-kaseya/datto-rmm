# Alert Type Reference

Common Datto RMM alert types with causes and resolution strategies.

---

## Device Status Alerts

### Device Offline
**Priority:** Critical  
**Trigger:** Device hasn't communicated with RMM for specified time  
**Common Causes:**
- Network connectivity lost
- Device powered off
- RMM agent service stopped
- Firewall blocking RMM traffic

**Resolution Strategy:**
1. Check if device is powered on and accessible
2. Verify network connectivity
3. Restart RMM agent if device is reachable
4. Check for firewall or network changes

**Tools:** `get-device-health`, `investigate-alert`

---

## Resource Alerts

### Disk Space Low
**Priority:** Warning (>80%), Critical (>90%)  
**Trigger:** Disk usage exceeds threshold  
**Common Causes:**
- Log files growing unchecked
- Temporary files accumulating
- Backups stored locally
- Database growth

**Resolution Strategy:**
1. Run disk cleanup component
2. Clear temporary files and caches
3. Review and archive or delete old files
4. Check for unusual growth patterns

**Tools:** `diagnose-device-issue`, `run-site-component` (Disk Cleanup)

### High CPU Usage
**Priority:** Warning (>80%), Critical (>95%)  
**Trigger:** CPU usage sustained above threshold  
**Common Causes:**
- Runaway process or service
- Antivirus scanning
- Windows Update processing
- Application performance issues

**Resolution Strategy:**
1. Identify top CPU consumers
2. Determine if usage is expected (updates, scans)
3. Restart problematic service or process
4. If persistent, investigate application issues

**Tools:** `get-device-health`, `run-site-component` (Get Top Processes)

### High Memory Usage
**Priority:** Warning (>85%), Critical (>95%)  
**Trigger:** Memory usage exceeds threshold  
**Common Causes:**
- Memory leak in application
- Insufficient RAM for workload
- Too many concurrent processes
- Caching aggressive

**Resolution Strategy:**
1. Identify memory consumers
2. Restart services with memory leaks
3. If insufficient RAM, recommend upgrade
4. Optimize application memory settings

**Tools:** `diagnose-device-issue`, `run-site-component` (Get Top Memory)

---

## Service Alerts

### Service Stopped
**Priority:** Critical (critical services), Warning (non-critical)  
**Trigger:** Monitored Windows service not running  
**Common Causes:**
- Service crashed
- Dependencies failed
- Manual stop
- System resource exhaustion

**Resolution Strategy:**
1. Check Windows Event Log for crash details
2. Verify service dependencies are running
3. Restart service
4. If restart fails, check permissions and config
5. If crashes repeatedly, fix root cause

**Tools:** `get-device-health`, `run-site-component` (Restart Service)

### Service Restart Loop
**Priority:** Warning  
**Trigger:** Service restarting repeatedly within time window  
**Common Causes:**
- Configuration error
- Disk full preventing service start
- Permissions issue
- Corrupt service files

**Resolution Strategy:**
1. Stop automatic restart to break loop
2. Check Event Log for error details
3. Verify disk space and permissions
4. Fix configuration or repair service files
5. Restart service manually after fix

**Tools:** `investigate-alert`, `diagnose-device-issue`

---

## Security Alerts

### Antivirus Out of Date
**Priority:** Warning (definitions), Critical (multiple days old)  
**Trigger:** Antivirus signature database not updated recently  
**Common Causes:**
- Network connectivity issues
- AV update service not running
- Update server unreachable
- AV software malfunction

**Resolution Strategy:**
1. Check network connectivity
2. Verify AV service is running
3. Manually trigger definition update
4. If persistent, reinstall AV agent

**Tools:** `run-site-component` (Update AV Definitions)

### Firewall Disabled
**Priority:** Critical  
**Trigger:** Windows Firewall is turned off  
**Common Causes:**
- Intentional for troubleshooting
- Third-party firewall conflict
- Malware disabled it
- Group Policy change

**Resolution Strategy:**
1. Verify if intentional
2. Check for third-party firewall
3. Enable Windows Firewall if appropriate
4. Scan for malware if unexplained
5. Review Group Policy settings

**Tools:** `run-site-component` (Check Firewall Status)

---

## Backup Alerts

### Backup Failed
**Priority:** Critical  
**Trigger:** Scheduled backup job failed to complete  
**Common Causes:**
- Disk space insufficient
- Files locked (in use)
- Network connectivity to backup target lost
- Backup service stopped
- Permissions issue

**Resolution Strategy:**
1. Check disk space on source and destination
2. Verify network connectivity to backup target
3. Check for file locks preventing backup
4. Verify backup service is running
5. Review backup job logs for specific errors

**Tools:** `get-job-results`, `diagnose-device-issue`

### Backup Incomplete
**Priority:** Warning  
**Trigger:** Backup completed but some files skipped  
**Common Causes:**
- Files in use
- Files with long paths
- Permission denied on some files
- Source files deleted during backup

**Resolution Strategy:**
1. Review backup logs for skipped files
2. Determine if skipped files are critical
3. Retry backup during low-usage period
4. Exclude non-critical files causing issues

**Tools:** `get-job-results`

---

## Update Alerts

### Windows Updates Pending Reboot
**Priority:** Warning (>7 days), Critical (>14 days)  
**Trigger:** Updates installed but reboot not performed  
**Common Causes:**
- Users postponing reboot
- Updates installed outside maintenance window
- Automatic reboot disabled
- System left on continuously

**Resolution Strategy:**
1. Notify users of pending reboot
2. Schedule reboot during maintenance window
3. If critical updates, force reboot with notice
4. Review update policy to prevent accumulation

**Tools:** `run-site-component` (Reboot System)

### Windows Update Failed
**Priority:** Warning (non-security), Critical (security updates)  
**Trigger:** Windows Update installation failed  
**Common Causes:**
- Disk space insufficient
- Update cache corrupt
- Update service issues
- Superseded by newer update

**Resolution Strategy:**
1. Check disk space
2. Clear Windows Update cache
3. Repair update services
4. Manually download and install update
5. If persistent, consider in-place upgrade

**Tools:** `run-site-component` (Clear Update Cache, Repair Update Services)

---

## Performance Alerts

### High Response Time
**Priority:** Warning  
**Trigger:** System response time degraded  
**Common Causes:**
- CPU or memory exhaustion
- Disk I/O saturation
- Network latency
- Too many concurrent processes

**Resolution Strategy:**
1. Check CPU, memory, and disk usage
2. Identify resource bottleneck
3. Address bottleneck (free resources, upgrade hardware)
4. Optimize application or workload

**Tools:** `get-device-health`, `diagnose-device-issue`

---

## Network Alerts

### Network Adapter Down
**Priority:** Critical  
**Trigger:** Network adapter not operational  
**Common Causes:**
- Network cable unplugged
- Switch port disabled
- Driver failure
- Hardware failure

**Resolution Strategy:**
1. Check physical connections
2. Verify switch port is active
3. Restart network adapter
4. Update or reinstall network driver
5. If hardware failure, replace adapter

**Tools:** `get-device-health`, `run-site-component` (Network Diagnostics)

### DNS Resolution Failure
**Priority:** Warning  
**Trigger:** Unable to resolve DNS names  
**Common Causes:**
- DNS server unreachable
- DNS server misconfigured
- Network connectivity issue
- Local DNS cache corruption

**Resolution Strategy:**
1. Verify DNS server settings
2. Test connectivity to DNS servers
3. Clear DNS cache
4. Try alternative DNS servers temporarily
5. Check for network-wide DNS issues

**Tools:** `run-site-component` (Network Diagnostics)

---

## Pattern Recognition

### Alert Storms
Multiple related alerts firing simultaneously often indicate:
- Systemic issue affecting multiple components
- Cascading failure (one issue causing others)
- Environmental factor (power, network)

**Response:** Use `investigate-alert` with include_similar to find patterns

### Recurring Alerts
Same alert repeatedly resolving and reopening indicates:
- Root cause not addressed
- Threshold too sensitive
- Intermittent issue

**Response:** Use `diagnose-device-issue` to identify underlying cause

### Site-Wide Patterns
Same alert across multiple devices at site suggests:
- Network or infrastructure issue
- Common configuration problem
- Environmental factor

**Response:** Use `get-site-alerts` and `find-sites-with-issues`

---

## Alert Management Best Practices

### Prioritization
1. Critical alerts first (device offline, security, backup failures)
2. Warnings before they become critical
3. Group related alerts for efficient resolution
4. Use alert summary for pattern identification

### Investigation
1. Use `investigate-alert` for context and patterns
2. Check device health before taking action
3. Review alert history for recurring issues
4. Consider site-wide impact

### Resolution
1. Address root cause, not just symptom
2. Verify fix with follow-up monitoring
3. Document resolution for future reference
4. Update procedures if new pattern discovered

### Prevention
1. Set up proactive monitoring for critical services
2. Schedule regular maintenance (cleanup, updates)
3. Address warnings before they become critical
4. Review alert trends for capacity planning
