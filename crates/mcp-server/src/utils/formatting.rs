/// Utility functions for formatting MCP tool responses
pub fn format_sites_with_issues_placeholder() -> String {
    "# Sites With Issues\n\n\
     Found 3 sites:\n\n\
     1. **Acme Corp** (Site UID: acme123)\n\
        🔴 12 critical alerts\n\
        ⚠️  3 warnings\n\
        📵 5 offline devices\n\
        Common: Disk Space (4), Service Down (3), Offline (5)\n\n\
     2. **TechStart Inc** (Site UID: tech456)\n\
        🔴 8 critical alerts\n\
        📵 2 offline devices\n\
        Common: Backup Failed (5), Offline (2)\n\n\
     💡 **Next:** Run rmm_get_site_health({ site: \"Acme Corp\" }) for details"
        .to_string()
}

pub fn format_device_list_placeholder() -> String {
    "# Device List\n\n\
     ## Servers (8 online, 1 offline)\n\
     1. 🟢 web-server-01 - Windows Server 2022\n\
     2. 🟢 db-server-01 - Windows Server 2019\n\
     3. 🔴 app-server-01 - Windows Server 2022 (offline)\n\n\
     ## Workstations (15 online, 1 offline)\n\
     ..."
        .to_string()
}

/// Format boolean as emoji badge
pub fn status_badge(online: bool) -> &'static str {
    if online {
        "🟢"
    } else {
        "🔴"
    }
}

/// Format severity as emoji
pub fn severity_badge(severity: &str) -> &'static str {
    match severity.to_lowercase().as_str() {
        "critical" => "🔴",
        "warning" => "⚠️",
        "info" => "ℹ️",
        _ => "•",
    }
}
