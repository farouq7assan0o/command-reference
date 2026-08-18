/*
 * vars.js - Canonical engagement-variable registry (SINGLE SOURCE OF TRUTH).
 *
 * THE PROBLEM THIS SOLVES:
 *   Commands are written with <placeholder> tokens. If five cards write the same concept
 *   five different ways (<ip>, <target>, <host>, <rhost>, <IP>), the global Target Context
 *   bar can't fill them - you'd have to retype the value on every card. This registry
 *   defines the CANONICAL name for each engagement variable, plus the aliases that mean
 *   the same thing, so one field fills every spelling.
 *
 * USED BY:
 *   - index.html app  -> auto-builds the Target Context bar from this (grouped, core + more).
 *   - substitute()     -> alias-aware, so <target>/<host> fill from the single `ip` field.
 *   - validate.js      -> flags any placeholder NOT in this registry (the future-proof guard).
 *   - exam.html        -> (intended) same registry, so both pages share one vocabulary.
 *
 * TO ADD A VARIABLE: add one entry below. If a card legitimately needs a NEW engagement
 * variable, add it here (with core:true if it's globally reusable) and it appears in the bar
 * automatically. If a token is a genuine one-off local to a single command, DON'T add it here
 * - it still gets a per-command field in the Command Builder. The validator lists unknown
 * tokens so you can decide: canonicalize (add alias) or leave local.
 *
 * FIELDS:
 *   key     - the canonical placeholder name (what <...> should be written as).
 *   label   - human label shown in the bar.
 *   group   - section in the context bar.
 *   core    - true = always visible in the bar; false = hidden under "more variables".
 *   aliases - other spellings that should be filled by this same value.
 */

const VAR_REGISTRY = [
    // ---- Target ----
    { key: 'ip',        label: 'Target IP',     group: 'Target',   core: true,  aliases: ['target', 'host', 'target_ip', 'host_ip', 'rhost', 'IP', 'addr', 'internal_target', 'target_fqdn', 'hostname'] },
    { key: 'port',      label: 'Port',          group: 'Target',   core: true,  aliases: ['target_port', 'rport'] },
    { key: 'cidr',      label: 'CIDR / Subnet', group: 'Target',   core: false, aliases: ['subnet', 'target_subnet', 'range'] },
    { key: 'url',       label: 'URL',           group: 'Target',   core: true,  aliases: [] },

    // ---- Auth ----
    { key: 'user',      label: 'User',          group: 'Auth',     core: true,  aliases: ['username', 'login', 'account'] },
    { key: 'password',  label: 'Password',      group: 'Auth',     core: true,  aliases: ['pass', 'passwd', 'plaintext'] },
    { key: 'hash',      label: 'Hash',          group: 'Auth',     core: true,  aliases: [] },
    { key: 'nt_hash',   label: 'NT Hash',       group: 'Auth',     core: false, aliases: ['ntlm_hash', 'nthash', 'nt'] },
    { key: 'newuser',   label: 'New User',      group: 'Auth',     core: false, aliases: ['target_user'] },
    { key: 'newpass',   label: 'New Password',  group: 'Auth',     core: false, aliases: ['cpassword'] },

    // ---- Active Directory ----
    { key: 'domain',    label: 'Domain',        group: 'Active Directory', core: true,  aliases: ['realm', 'REALM'] },
    { key: 'dc_ip',     label: 'DC IP',         group: 'Active Directory', core: true,  aliases: ['parent_dc_ip'] },
    { key: 'dc_host',   label: 'DC Hostname',   group: 'Active Directory', core: false, aliases: ['dc_host_fqdn', 'dc_fqdn', 'dc'] },
    { key: 'base_dn',   label: 'Base DN',       group: 'Active Directory', core: false, aliases: [] },

    // ---- Attacker ----
    { key: 'lhost',     label: 'LHOST (you)',   group: 'Attacker', core: true,  aliases: ['attacker_ip', 'kali_ip'] },
    { key: 'lport',     label: 'LPORT',         group: 'Attacker', core: true,  aliases: ['listen_port', 'local_port', 'handler_port'] },
    { key: 'interface', label: 'Interface',     group: 'Attacker', core: false, aliases: [] },

    // ---- Services / Pivot ----
    { key: 'share',     label: 'SMB Share',     group: 'Services', core: false, aliases: [] },
    { key: 'db',        label: 'Database',      group: 'Services', core: false, aliases: [] },
    { key: 'sid',       label: 'Oracle SID',    group: 'Services', core: false, aliases: ['oracle_sid'] },
    { key: 'pivot_ip',  label: 'Pivot Host',    group: 'Services', core: false, aliases: ['pivot'] },

    // ---- Files / Wordlists ----
    { key: 'wordlist',  label: 'Wordlist',      group: 'Files',    core: false, aliases: [] },
    { key: 'userlist',  label: 'User List',     group: 'Files',    core: false, aliases: ['hostfile'] },
    { key: 'file',      label: 'File',          group: 'Files',    core: false, aliases: ['local_file', 'target_file'] },
    { key: 'hash_file', label: 'Hash File',     group: 'Files',    core: false, aliases: ['hashfile'] },
];

// ---- derived lookups (built once) ----
const VAR_BY_KEY = {};
const ALIAS_TO_CANON = {};   // any alias OR canonical key -> canonical key
for (const v of VAR_REGISTRY) {
    VAR_BY_KEY[v.key] = v;
    ALIAS_TO_CANON[v.key] = v.key;
    for (const a of v.aliases) ALIAS_TO_CANON[a] = v.key;
}

/** Canonical key for any placeholder token, or null if it's not a registered engagement var. */
function canonVar(token) {
    return ALIAS_TO_CANON[token] || null;
}

/** All tokens (canonical + aliases) that map to a given canonical key. */
function tokensFor(key) {
    const v = VAR_BY_KEY[key];
    return v ? [key, ...v.aliases] : [key];
}

// expose globally (no modules in this project)
if (typeof window !== 'undefined') {
    window.VAR_REGISTRY = VAR_REGISTRY;
    window.VAR_BY_KEY = VAR_BY_KEY;
    window.ALIAS_TO_CANON = ALIAS_TO_CANON;
    window.canonVar = canonVar;
    window.tokensFor = tokensFor;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { VAR_REGISTRY, VAR_BY_KEY, ALIAS_TO_CANON, canonVar, tokensFor };
}
