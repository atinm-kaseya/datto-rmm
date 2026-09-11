# Troubleshooting Guide

Issue-specific troubleshooting workflows for common problems in MSP environments.

---

## Device Offline

**Symptoms:**
- Device showing as offline in RMM
- Unable to connect remotely
- Jobs failing with "device unreachable"

**Investigation Tools:**
- `get-device-health`: Check last seen timestamp and recent activity
- `investigate-alert`: If offline alert exists, check context and similar alerts

**Common Causes:**
1. Network issue - Device lost connectivity
2. Agent stopped - Datto RMM agent service not running
3. Device powered off - Maintenance or failure
4. Firewall blocking - New firewall rules blocking RMM traffic

**Resolution Steps:**
1. Verify device is powered on and on network (ping, remote access)
2. If accessible remotely, check Datto RMM service status
3. Restart agent via `run-site-component` with "Restart RMM Agent"
4. Check firewall rules if pattern across multiple devices
5. Check proxy configuration if needed (`get-site-settings`)

---

## Disk Space Low/Critical

**Symptoms:**
- Disk space alerts (critical when >90% full)
- Application errors related to disk writes
- Backup failures due to insufficient space

**Investigation Tools:**
- `get-device-health`: Check disk capacity and free space percentage
- `diagnose-device-issue` with issue: "disk space"

**Common Causes:**
1. Log files growing - Application logs not rotating
2. Temp files accumulating - Windows Update cache, SQL temp files
3. Backup files - Local backup retention too long
4. User data - Large files in user profiles
5. Database growth - SQL databases expanding

**Resolution Steps:**
1. Run "Disk Cleanup" component
2. Run "Clear Windows Update Cache" component
3. Run "Clear Temp Files" component
4. Run "Disk Usage Report" to identify space consumers
5. Archive or delete old files
6. If pattern across site: Use `get-site-alerts` and bulk cleanup

---

## High CPU Usage

**Symptoms:**
- CPU sustained above 80% for extended periods
- System responsiveness degraded
- Applications timing out

**Investigation Tools:**
- `get-device-health`: Check current CPU usage
- `diagnose-device-issue` with issue: "high CPU"

**Common Causes:**
1. Runaway process - Application stuck in loop
2. Antivirus scan - Full system scan running
3. Windows Update - Update installation in progress
4. Service instability - Service restarting repeatedly
5. Resource exhaustion - Insufficient CPU for workload

**Resolution Steps:**
1. Run "Get Top Processes" component to identify culprit
2. If antivirus: Wait or reschedule scan
3. If runaway: Restart service
4. If Windows Update: Check status and schedule reboot
5. If service loop: Fix underlying issue (disk space, permissions)

---

## Service Down

**Symptoms:**
- Critical service not running
- Application unavailable
- Service restart alerts

**Investigation Tools:**
- `get-device-health`: Check service status and recent alerts
- `investigate-alert`: Check service restart patterns

**Common Causes:**
1. Service crashed - Application bug or resource exhaustion
2. Dependencies failed - Required service/resource unavailable
3. Permissions issue - Service account permissions changed
4. Resource contention - Memory or disk exhaustion
5. Configuration error - Recent config change broke service

**Resolution Steps:**
1. Run "Get Service Status" component for detailed service info
2. Check Windows Event Log for crash details
3. Restart service via component
4. If restart fails: Check dependencies and permissions
5. If pattern repeats: Fix root cause (memory, disk, config)

---

## Memory Exhaustion

**Symptoms:**
- Memory usage consistently above 90%
- Applications crashing with out-of-memory errors
- System swapping heavily (high disk I/O)

**Investigation Tools:**
- `get-device-health`: Check memory usage and available RAM
- `diagnose-device-issue` with issue: "memory"

**Common Causes:**
1. Memory leak - Application not releasing memory
2. Insufficient RAM - Workload exceeds physical memory
3. Runaway process - Process allocating memory indefinitely
4. Caching excess - Application caching too aggressively
5. Too many services - System overloaded with services

**Resolution Steps:**
1. Run "Get Top Memory Consumers" component
2. Identify and restart problematic process/service
3. If memory leak: Update application or add restart schedule
4. If insufficient: Recommend RAM upgrade
5. Disable unnecessary services or applications

---

## Network Connectivity Issues

**Symptoms:**
- Intermittent disconnections
- Slow network performance
- DNS resolution failures

**Investigation Tools:**
- `get-device-health`: Check network adapter status
- `investigate-alert`: Look for network-related alert patterns

**Common Causes:**
1. Network adapter issues - Driver problems or hardware failure
2. DNS problems - DNS server unavailable or misconfigured
3. Network congestion - Bandwidth saturation
4. Firewall rules - Overly restrictive rules
5. DHCP issues - IP lease problems

**Resolution Steps:**
1. Run "Network Diagnostics" component
2. Check DNS settings and test resolution
3. Verify network adapter driver is current
4. Test connectivity to gateway and external IPs
5. If site-wide: Check upstream network infrastructure

---

## Windows Update Failures

**Symptoms:**
- Update installation fails repeatedly
- Error codes in Windows Update history
- System pending reboot for extended periods

**Investigation Tools:**
- `get-device-health`: Check pending updates and last successful update
- `diagnose-device-issue` with issue: "windows update"

**Common Causes:**
1. Disk space insufficient - Updates require temporary space
2. Service corruption - Update services not functioning
3. Cache corruption - Update cache contains invalid files
4. Third-party interference - Antivirus blocking update files
5. Superseded updates - Trying to install old updates

**Resolution Steps:**
1. Run "Clear Windows Update Cache" component
2. Ensure adequate disk space available
3. Run "Repair Windows Update Services" component
4. Manually download and install problematic updates
5. If persistent: Consider in-place upgrade or reset

---

## Backup Failures

**Symptoms:**
- Backup jobs failing repeatedly
- Backup alerts accumulating
- Backup data incomplete or corrupted

**Investigation Tools:**
- `get-device-health`: Check backup job history and disk space
- `get-job-results`: For specific backup job details

**Common Causes:**
1. Disk space - Insufficient space for backup data
2. File locks - Files in use cannot be backed up
3. Permissions - Backup account lacks necessary permissions
4. Network issues - Cannot reach backup destination
5. Backup agent issues - Backup software malfunction

**Resolution Steps:**
1. Check disk space on source and destination
2. Run "Close Open Files" component if file locks present
3. Verify backup service account permissions
4. Test network connectivity to backup destination
5. Restart backup agent or service

---

## Pattern-Based Troubleshooting

### Site-Wide Issues

When multiple devices at a site exhibit same problem:

1. Use `find-sites-with-issues` to identify affected site
2. Use `get-site-alerts` to see common alert patterns
3. Use `list-site-devices` with filters to find affected devices
4. Use `investigate-alert` with include_similar=true to find patterns
5. Use `bulk-update-site-devices` or `run-site-component` for mass remediation

### Account-Wide Patterns

When problem spans multiple sites:

1. Use `get-account-dashboard` to see global view
2. Use `get-alert-summary` with group_by="type" for patterns
3. Use `search-devices` to find all affected devices
4. Look for common factors (OS version, installed software, config)
5. Plan coordinated remediation across sites

### Recurring Issues

When problem keeps coming back:

1. Use `diagnose-device-issue` to identify root cause
2. Look at job history for failed remediation attempts
3. Check for underlying issues (disk space, permissions)
4. Implement preventative measures (scheduled cleanup, monitoring)
5. Document and create custom component if needed
