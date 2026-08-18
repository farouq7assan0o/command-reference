/*
 * groups.js - Middle grouping layer for the category tree (3-level nav).
 *
 * WHY: some categories have 30-40 subcategories (Enumeration, Privilege Escalation),
 * which is an unusable wall of links. This adds a Category -> GROUP -> Subcategory layer
 * WITHOUT touching a single card file - the group is DERIVED from (category, subcategory)
 * at render time. Edit this map to re-shape the tree; no data migration, no rebuild.
 *
 * HOW IT WORKS:
 *   - GROUP_MAP[category] = { "Group Name": ["Subcat A", "Subcat B", ...], ... }
 *   - PREFIX_RULES handle families named by prefix (e.g. every "Nmap - *", "Windows - *").
 *   - A category with NO entry here stays FLAT (2-level, unchanged).
 *   - A subcategory not listed under any group falls into "Other" for that category.
 *
 * groupFor(category, subcategory) -> group name string, or null if the category is flat.
 *
 * ENFORCED: `node validate.js` runs a Group audit that flags any subcategory in a grouped
 * category which is NOT listed here (it would silently fall into the "Other" bucket). When you
 * add a new subcategory to a card in a grouped category, add it to GROUP_MAP below (or a
 * PREFIX_RULE) - the audit tells you exactly which ones are missing. `--strict` fails on it.
 */

// Prefix families: if a subcategory starts with `prefix`, it belongs to `group`.
// Checked per-category so the same prefix can differ across categories if ever needed.
const PREFIX_RULES = {
    'Enumeration': [
        { prefix: 'Nmap - ', group: 'Nmap' },
    ],
    'Privilege Escalation': [
        { prefix: 'Windows - ', group: 'Windows' },
        { prefix: 'Linux - ', group: 'Linux' },
    ],
};

// Explicit subcategory -> group assignments, per category.
const GROUP_MAP = {
    'Enumeration': {
        'Active Directory': ['AD Enumeration', 'Active Directory', 'Domain Trusts', 'Privileged Access', 'AS-REP Roasting', 'ACL Abuse', 'Password Spraying'],
        'Network Services': ['SMB', 'SMB / NetBIOS', 'DNS', 'FTP', 'NFS', 'SNMP', 'SMTP', 'IMAP/POP3', 'IPMI', 'Oracle TNS'],
        'Databases': ['MySQL', 'MSSQL'],
        'Web Applications': ['WordPress', 'Joomla', 'Drupal', 'Tomcat', 'GitLab', 'IIS Tilde Enumeration', 'ColdFusion', 'Application Discovery', 'Web Enumeration', 'Client-Side Attacks'],
        'Remote Management': ['Linux Remote Management', 'Windows Remote Management'],
        'Recon & OSINT': ['Cloud', 'Cloud - AWS', 'Domain Information', 'Staff'],
        'General': ['Basic Tools', 'Methodology', 'Service Scanning', 'Vulnerability Scanning', 'Miscellaneous Misconfigurations'],
    },
    'Exploitation': {
        'Metasploit Framework': ['Metasploit', 'Metasploit Framework', 'Meterpreter', 'MSFVenom Payloads'],
        'Shells & Payloads': ['Shells', 'Shells & Payloads', 'Reverse Shells', 'Interactive Shells', 'Web Shells', 'AV Evasion', 'Public Exploits', 'Fixing Exploits', 'Buffer Overflow'],
        'Network Services': ['FTP', 'SMB', 'RDP', 'DNS', 'Email Services', 'SQL Databases', 'LDAP Injection'],
        'Web Applications': ['WordPress', 'Joomla', 'Drupal', 'Tomcat', 'Jenkins', 'Splunk', 'GitLab', 'PRTG Network Monitor', 'CGI Applications', 'Web Mass Assignment', 'Apps Connecting to Services', 'Other Applications', 'Thick Client', 'Web Applications', 'API Attacks', 'Client-Side Attacks'],
        'Cloud': ['Cloud - AWS'],
        'Bleeding Edge': ['Bleeding Edge Vulnerabilities'],
    },
    'Privilege Escalation': {
        // Windows/Linux come from PREFIX_RULES; only the non-prefixed ones need listing.
        'Active Directory': ['ACL Abuse', 'DCSync', 'Domain Trusts', 'Enumeration'],
        'Other': ['Bleeding Edge Vulnerabilities'],
    },
    'Web Exploitation': {
        'Injection': ['SQL Injection', 'SQLMap', 'Command Injection', 'XXE', 'SSTI', 'SSI', 'XSLT'],
        'File Attacks': ['File Inclusion', 'File Upload'],
        'Client-Side': ['XSS'],
        'Access Control': ['IDOR', 'HTTP Verb Tampering', 'Broken Authentication'],
        'APIs & SSRF': ['GraphQL', 'API Attacks', 'SSRF'],
        'Discovery & Brute Force': ['Fuzzing', 'Web Fuzzing', 'Login Brute Forcing', 'Web Proxies'],
    },
    'Password Attacks': {
        'Cracking': ['Hash Cracking', 'Cracking Protected Files', 'Wordlist Generation', 'Wordlists'],
        'AD & Network': ['Kerberoasting', 'AS-REP Roasting', 'LLMNR/NBT-NS Poisoning', 'Password Spraying'],
        'Brute Forcing': ['Brute Forcing', 'Credential Brute-Force'],
        'App-Specific': ['Joomla', 'Tomcat', 'WordPress'],
    },

    // ---- RED: flat-but-large categories given a middle layer (no card files changed) ----
    'Active Directory': {
        'Access': ['Foothold'],
        'Enumeration': ['Domain Enumeration'],
        'Privilege Escalation': ['Domain PrivEsc', 'Local PrivEsc'],
        'Lateral Movement': ['Lateral Movement', 'Cross-Trust'],
        'Persistence': ['Persistence'],
    },
    'Lateral Movement': {
        'Pass-the-X': ['Pass the Hash', 'Pass the Ticket', 'Pass the Certificate'],
        'Remote Execution': ['Remote Execution', 'DCOM', 'Double Hop'],
        'Scope & Trusts': ['Privileged Access', 'Domain Trusts', 'Cloud - AWS'],
    },
    'Credential Access': {
        'Dumping': ['DCSync', 'Credential Dumping'],
        'Roasting': ['AS-REP Roasting'],
        'Hunting': ['Credential Hunting', 'Miscellaneous Misconfigurations'],
        'Cloud': ['Cloud - AWS'],
        'Other': ['Bleeding Edge Vulnerabilities', 'Domain Trusts'],
    },
    'File Transfers': {
        'Windows': ['Windows Transfer', 'RDP & WinRM'],
        'Linux': ['Linux Transfer', 'Netcat'],
        'Techniques': ['Code One-liners', 'Base64', 'Encryption', 'LOLBins', 'WebDAV / FTP Servers', 'Web Servers', 'Basics'],
        'Detection & Evasion': ['Detection & Evasion'],
    },
    'Pivoting & Tunneling': {
        'SSH': ['SSH Tunneling'],
        'Proxy & Redirect': ['SOCKS Tunneling', 'Socat Redirection', 'Port Forwarding'],
        'Framework': ['Metasploit Pivoting'],
        'Covert Channels': ['DNS Tunneling', 'ICMP Tunneling', 'RDP Tunneling'],
    },
    'Vulnerability Assessment': {
        'Scanners': ['Nessus', 'OpenVAS', 'SSL/TLS Scanning'],
        'Standards & Scoring': ['Standards', 'CVSS', 'OVAL & CVE'],
        'Process': ['Methodology', 'Reporting', 'Monitoring'],
        'Other': ['Bleeding Edge Vulnerabilities'],
    },
    'Reconnaissance': {
        'DNS & Domains': ['DNS', 'Subdomains', 'Virtual Hosts', 'WHOIS', 'Certificate Transparency'],
        'OSINT': ['Search Engine OSINT', 'Web Archives'],
        'Active Recon': ['Crawling', 'Fingerprinting', 'Recon Automation', 'Web Reconnaissance'],
    },

    // ---- BLUE: SOC categories given a middle layer ----
    'Active Directory Defense': {
        'Kerberos': ['Kerberos Attacks'],
        'Credentials': ['Credential Exposure'],
        'Delegation & Coercion': ['Coercion Attacks'],
        'PKI': ['PKI Attacks'],
        'AD Objects': ['GPO Abuse', 'ACL Abuse', 'Privilege Escalation'],
    },
    'Malware Analysis': {
        'Foundations': ['Fundamentals', 'Windows Internals'],
        'Analysis Techniques': ['Static Analysis', 'Dynamic Analysis', 'Code Analysis', 'Debugging'],
        'Detection': ['Detection Rules'],
    },
    'Network Traffic Analysis': {
        'Workflow': ['NTA Workflow'],
        'Tools': ['TCPDump', 'Wireshark / TShark'],
        'Protocol Detections': ['ARP Detection', 'HTTP Detection', 'IP Layer Detection', 'SSL & DNS Detection', 'TCP Detection', 'Tunneling & Exfil Detection', 'Wireless Detection'],
    },
};

// Optional: preferred display order of groups within a category (unlisted groups go after, A-Z).
const GROUP_ORDER = {
    'Enumeration': ['General', 'Nmap', 'Network Services', 'Databases', 'Web Applications', 'Remote Management', 'Active Directory', 'Recon & OSINT'],
    'Exploitation': ['Shells & Payloads', 'Metasploit Framework', 'Network Services', 'Web Applications', 'Cloud', 'Bleeding Edge'],
    'Privilege Escalation': ['Windows', 'Linux', 'Active Directory', 'Other'],
    'Web Exploitation': ['Injection', 'File Attacks', 'Client-Side', 'Access Control', 'APIs & SSRF', 'Discovery & Brute Force'],
    'Password Attacks': ['Cracking', 'Brute Forcing', 'AD & Network', 'App-Specific'],
    'Active Directory': ['Access', 'Enumeration', 'Privilege Escalation', 'Lateral Movement', 'Persistence'],
    'Lateral Movement': ['Pass-the-X', 'Remote Execution', 'Scope & Trusts'],
    'Credential Access': ['Dumping', 'Roasting', 'Hunting', 'Cloud', 'Other'],
    'File Transfers': ['Windows', 'Linux', 'Techniques', 'Detection & Evasion'],
    'Pivoting & Tunneling': ['SSH', 'Proxy & Redirect', 'Framework', 'Covert Channels'],
    'Vulnerability Assessment': ['Scanners', 'Standards & Scoring', 'Process', 'Other'],
    'Reconnaissance': ['DNS & Domains', 'OSINT', 'Active Recon'],
    'Active Directory Defense': ['Kerberos', 'Credentials', 'Delegation & Coercion', 'PKI', 'AD Objects'],
    'Malware Analysis': ['Foundations', 'Analysis Techniques', 'Detection'],
    'Network Traffic Analysis': ['Workflow', 'Tools', 'Protocol Detections'],
};

// Top-level category display order. RED follows the attack lifecycle (recon -> ... -> cleanup);
// BLUE follows the SOC/defender workflow (monitor -> detect -> hunt -> analyse -> respond).
// The app renders Red and Blue as separate tree sections, so it sorts each section's categories
// by this index; any category NOT listed here falls to the end, alphabetically.
const CATEGORY_ORDER = [
    // ---- RED: offensive attack lifecycle ----
    'Fundamentals',
    'Reconnaissance',
    'Enumeration',
    'Vulnerability Assessment',
    'Exploitation',
    'Web Exploitation',
    'File Transfers',
    'Privilege Escalation',
    'Credential Access',
    'Password Attacks',
    'Lateral Movement',
    'Pivoting & Tunneling',
    'Active Directory',
    'Persistence',
    'Defense Evasion',
    // ---- BLUE: SOC / defender workflow ----
    'SIEM',
    'IDS/IPS',
    'Network Traffic Analysis',
    'Threat Detection',
    'Threat Hunting',
    'Windows Events/Forensics',
    'Malware Analysis',
    'Digital Forensics',
    'Active Directory Defense',
    'Incident Response',
];
const _catRank = {};
CATEGORY_ORDER.forEach((c, i) => { _catRank[c] = i; });

/** Order a list of category names by the lifecycle order above (unlisted -> end, A-Z). */
function orderCategories(cats) {
    return [...cats].sort((a, b) => {
        const ia = _catRank[a], ib = _catRank[b];
        if (ia != null && ib != null) return ia - ib;
        if (ia != null) return -1;
        if (ib != null) return 1;
        return a.localeCompare(b);
    });
}

// Build a fast reverse lookup once: category -> subcategory -> group.
const _reverse = {};
for (const [cat, groups] of Object.entries(GROUP_MAP)) {
    _reverse[cat] = {};
    for (const [group, subs] of Object.entries(groups)) {
        for (const s of subs) _reverse[cat][s] = group;
    }
}

/** Return the group name for a card, or null if its category is flat (no grouping). */
function groupFor(category, subcategory) {
    const hasPrefix = PREFIX_RULES[category];
    const hasMap = GROUP_MAP[category];
    if (!hasPrefix && !hasMap) return null;          // flat category
    // prefix families first
    if (hasPrefix) {
        for (const rule of hasPrefix) {
            if (subcategory && subcategory.startsWith(rule.prefix)) return rule.group;
        }
    }
    // explicit map
    if (hasMap && _reverse[category] && _reverse[category][subcategory]) {
        return _reverse[category][subcategory];
    }
    return 'Other';                                   // grouped category, unmapped subcat
}

/** Is this category grouped (3-level) or flat (2-level)? */
function categoryIsGrouped(category) {
    return !!(PREFIX_RULES[category] || GROUP_MAP[category]);
}

/**
 * Is this (category, subcategory) EXPLICITLY placed into a group (prefix rule or GROUP_MAP),
 * as opposed to hitting the "Other" fallback? Flat categories return true (nothing to map).
 * validate.js uses this to flag a subcategory that was added to a card but never assigned a
 * group here - so the tree can't silently accumulate unmapped links in "Other".
 */
function isSubcatMapped(category, subcategory) {
    if (!categoryIsGrouped(category)) return true;
    const hasPrefix = PREFIX_RULES[category];
    if (hasPrefix) for (const rule of hasPrefix) {
        if (subcategory && subcategory.startsWith(rule.prefix)) return true;
    }
    return !!(_reverse[category] && _reverse[category][subcategory]);
}

/** Order groups for display within a category. */
function orderGroups(category, groupNames) {
    const pref = GROUP_ORDER[category] || [];
    return [...groupNames].sort((a, b) => {
        const ia = pref.indexOf(a), ib = pref.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        if (a === 'Other') return 1;                  // Other always last
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    });
}

// expose globally (no modules in this project)
window.groupFor = groupFor;
window.categoryIsGrouped = categoryIsGrouped;
window.isSubcatMapped = isSubcatMapped;
window.orderGroups = orderGroups;
window.orderCategories = orderCategories;
