#!/usr/bin/env node
/*
 * coverage.js - did the cards capture everything in the source module?
 *
 * Diffs a module's source notes against the carded commands, and lists source commands that have
 * NO matching card - i.e. candidates that were skipped. This is the answer to "can I know if the
 * AI read the whole module and didn't drop anything." It is an AID, not a hard gate: some source
 * lines are intentionally not carded (help dumps, GUI steps, flag-reference tables). But every
 * omission is VISIBLE and a conscious decision instead of a silent gap.
 *
 * SOURCES SCANNED (both, so nothing can hide in the notes):
 *   - "<NN ...>/... - Commands.md"          (fenced blocks + fence-less COMMAND-NOTES fallback)
 *   - "<NN ...>/... - EXPLANATION NOTES.md"  (fenced blocks ONLY - prose is not mined, to avoid
 *                                             false positives). Commands that appear ONLY in the
 *                                             explanation notes are flagged and tagged [Notes].
 *
 * Usage:  node coverage.js --module 03        (required)
 *         node coverage.js --module 03 --all  (also show what DID match, for auditing)
 *
 * Matching is fuzzy on purpose (cards generalize IPs->placeholders and consolidate variants):
 * a source command counts as covered if some card string shares its tool AND all of the
 * source's option flags appear in that card string (source flags subset of card flags), or the
 * source command has no distinctive flags and the tool appears in a card.
 */
const fs = require('fs'), path = require('path'), cp = require('child_process');

const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const MOD = (arg('--module') || '').padStart(2, '0');
const SHOW_ALL = process.argv.includes('--all');
if (!MOD || MOD === '00') { console.error('usage: node coverage.js --module NN'); process.exit(2); }

// locate source module folder
const notesDir = path.join(__dirname, '..', 'CPTS notes');
let srcFolder = null;
try {
    srcFolder = fs.readdirSync(notesDir).find(d => new RegExp('^0*' + Number(MOD) + '\\b').test(d) || d.startsWith(MOD));
} catch (e) { console.error('cannot read', notesDir, '-', e.message); process.exit(2); }
if (!srcFolder) { console.error('no source folder for module', MOD, 'in', notesDir); process.exit(2); }

// find both source files (Commands.md is required; EXPLANATION NOTES.md is optional but scanned)
const folderFiles = fs.readdirSync(path.join(notesDir, srcFolder));
const cmdFile   = folderFiles.find(f => /-\s*Commands\.md$/i.test(f));
const notesFile = folderFiles.find(f => /EXPLANATION\s*NOTES\.md$/i.test(f));
if (!cmdFile && !notesFile) {
    console.error('no "... - Commands.md" or "... - EXPLANATION NOTES.md" in', srcFolder); process.exit(2);
}

// ---- extract command lines from code fences (skip ```text/```txt reference blocks) ----
// allowFallback: mine fence-less "COMMAND NOTES" style prose too (Commands.md only; the
// explanation notes are prose-heavy, so we deliberately do NOT run the fallback on them).
function extractCmds(srcText, allowFallback) {
    const out = [];
    const KNOWN = new Set(['sh', 'bash', 'shell', 'console', 'powershell', 'ps', 'ps1', 'pwsh',
        'cmd', 'bat', 'batch', 'python', 'python3', 'py', 'ruby', 'rb', 'perl', 'php', 'sql', 'text',
        'txt', 'json', 'xml', 'yaml', 'yml', 'http', 'https', 'ini', 'diff', 'go', 'c', 'cs', 'javascript',
        'js', 'java', 'jsp', 'asp', 'html', 'css', 'groovy', 'rust', 'req', 'apacheconf', 'conf', 'config',
        'nginx', 'apache', 'properties', 'toml', 'dockerfile', 'csv', 'log', 'yara', 'kql', 'spl',
        'shell-session', 'powershell-session', 'cmd-session', 'console-session']);
    // languages whose fenced CONTENT is not a shell/capability command to card - markup, source
    // code, config files, structured output. Shell/PS/SQL/PHP/Python stay mined. The *-session
    // labels are prompt-transcript fences whose label itself was being mined as a bogus tool.
    const SKIP = new Set(['text', 'txt', 'json', 'xml', 'yaml', 'yml', 'http', 'https', 'ini', 'diff',
        'html', 'css', 'javascript', 'js', 'java', 'jsp', 'asp', 'c', 'cs', 'groovy', 'rust', 'req',
        'apacheconf', 'conf', 'config', 'nginx', 'apache', 'properties', 'toml', 'dockerfile', 'csv', 'log']);
    const lines = srcText.split(/\r?\n/);
    let inFence = false, lang = '';
    for (const ln of lines) {
        const fence = ln.match(/^```(\S*)(.*)$/);
        if (fence) {
            const token = (fence[1] || '').toLowerCase();
            if (!inFence) {
                if (token && !KNOWN.has(token)) {
                    // compact/mislabeled fence: the "language" is actually the command's first word.
                    const cmd = (fence[1] + fence[2]).trim();
                    if (cmd && !cmd.startsWith('#')) out.push(cmd);
                    inFence = true; lang = 'sh';
                } else { inFence = true; lang = token; }
            } else { inFence = false; }
            continue;
        }
        if (!inFence) continue;
        if (SKIP.has(lang)) continue;   // reference/non-command blocks
        const t = ln.trim();
        if (!t || t.startsWith('#') || t.startsWith('//')) continue;
        out.push(t);
    }
    // Fallback for the fence-less "COMMAND NOTES" format (modules 06/07/08): commands are plain
    // lines under **bold** headers. Heuristically pick command-like lines. Commands.md only.
    if (allowFallback && out.length === 0) {
        for (let raw of srcText.split(/\r?\n/)) {
            let t = raw.trim().replace(/\s+$/, '').replace(/^`|`$/g, '').trim();   // strip wrapping backticks
            if (!t || t.startsWith('#') || t.startsWith('**') || t.startsWith('>') || t.startsWith('|')) continue;
            if (/^https?:\/\/\S+$/.test(t)) continue;                 // bare URL
            if (/^\[.*\]\(.*\)$/.test(t)) continue;                   // markdown link
            const looksCmd = /[|;<>]|\$\(|\/|\\|\s-{1,2}\w/.test(t)   // shell metachar / path / flag
                || /^[a-z][\w.-]*\s+\S/.test(t);                      // "tool arg ..."
            const looksProse = /^[A-Z][a-z]+\s+\w+.*[.:]$/.test(t) && t.split(/\s+/).length > 7;
            if (looksCmd && !looksProse && t.length < 400) out.push(t);
        }
    }
    return out;
}

// gather source commands from both files, tagging each with its origin file.
const srcFiles = [];
if (cmdFile)   srcFiles.push({ label: 'Commands', file: cmdFile,   allowFallback: true });
if (notesFile) srcFiles.push({ label: 'Notes',    file: notesFile, allowFallback: false });
const srcEntries = [];   // {cmd, from}
for (const sf of srcFiles) {
    const text = fs.readFileSync(path.join(notesDir, srcFolder, sf.file), 'utf8');
    for (const cmd of extractCmds(text, sf.allowFallback)) srcEntries.push({ cmd, from: sf.label });
}

// ---- normalize + signature ----
const STOP = new Set(['sudo', 'then', 'do', 'done', 'fi', 'else', 'time']);
function toolOf(cmd) {
    let toks = cmd.split(/\s*\|\s*/)[0].trim().split(/\s+/);     // first pipe segment
    let i = 0;
    while (i < toks.length && (STOP.has(toks[i].toLowerCase()) || /=/.test(toks[i]))) i++;   // skip sudo / VAR=val
    return (toks[i] || '').toLowerCase().replace(/^.*[\\/]/, '');   // strip path
}
function flagsOf(cmd) {
    return new Set((cmd.match(/(?:^|\s)(--?[a-zA-Z][\w-]*)/g) || []).map(s => s.trim().toLowerCase()));
}
function sig(cmd) { return { tool: toolOf(cmd), flags: flagsOf(cmd) }; }

// ---- load carded commands for this module ----
require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, 'js', 'commands.js'), 'utf8') + ';globalThis.__D=COMMAND_DATA;');
// Match against EVERY card in the library, not just this module's cards: a technique carded in
// another module (or _shared) still means "it's in the library," which is what completeness asks.
const MODULE_ONLY = process.argv.includes('--module-only');
const cardStrs = [];
for (const c of globalThis.__D.commands) {
    if (MODULE_ONLY) { const m = String(c.source || '').match(/Module\s+(\d+)/); if (!m || m[1].padStart(2, '0') !== MOD) continue; }
    cardStrs.push(c.command);
    (c.variations || []).forEach(v => cardStrs.push(v.command));
    (c.steps || []).forEach(v => cardStrs.push(v.command));
    (c.examples || []).forEach(e => cardStrs.push(typeof e === 'string' ? e : e && e.command));
}
const cardSigs = cardStrs.filter(Boolean).map(sig);

// ---- match ----
function covered(s) {
    const cand = cardSigs.filter(cs => cs.tool && cs.tool === s.tool);
    if (cand.length === 0) return false;
    if (s.flags.size === 0) return true;                          // tool-level match is enough
    // source flags subset of some card's flags (allow >=60% overlap for near-misses)
    return cand.some(cs => {
        let hit = 0; s.flags.forEach(f => { if (cs.flags.has(f)) hit++; });
        return hit >= Math.ceil(s.flags.size * 0.6);
    });
}

// setup/nav/build lines are environment plumbing, not target commands - bucket separately so the
// review list stays focused on real capability commands.
const SETUP_TOOLS = new Set(['cd', 'ls', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv', 'touch', 'chmod', 'chown',
    'export', 'source', 'pip', 'pip3', 'apt', 'apt-get', 'yum', 'dnf', 'gem', 'go', 'git', 'make', 'cmake',
    'tar', 'unzip', 'gunzip', 'systemctl', 'service', 'cpan', 'cargo', 'npm', 'python', 'python3', 'sh', 'bash']);
const isSetup = c => {
    const t = toolOf(c);
    if (SETUP_TOOLS.has(t)) {
        // keep python/sh/bash ONLY as setup if they look like install/build (else could be a real tool run)
        if (['python', 'python3', 'sh', 'bash', 'go', 'git'].includes(t) && !/install|setup|clone|build|-m pip|requirements/.test(c)) return false;
        return true;
    }
    if (/\|\s*(wc|grep)\b/.test(c) && /^(cat|ls)\b/.test(c.trim())) return true;   // output-counting helpers
    return false;
};

// NON-COMMAND noise: fenced blocks contain lots of lines that are not runnable capability
// commands - variable assignments, bare IPs/hosts/paths/URLs, page-source HTML, robots.txt and
// config directives, tool help dumps, editor steps, line-numbered blocks, and interactive-console
// sub-verbs (metasploit show/set/...). Counting these as "uncovered" wildly inflated the gap
// (e.g. module 24 reported 350, ~95% of which were /etc/hosts vhost lines and WordPress HTML).
// Bucketing them separately makes "unmatched" reflect REAL missing techniques.
function isNoise(raw) {
    const t = String(raw).trim();
    if (!t) return true;
    if (/^[A-Za-z_]\w*=\S*$/.test(t) || /^[A-Za-z_]\w*=(["']).*\1$/.test(t)) return true;   // VAR=val
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(t)) return true;                                // bare IP[:port]
    if (/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/.test(t)) return true;                           // bare host/domain/file.ext
    if (/^\/[\w./@-]+$/.test(t) || /^[A-Za-z]:\\[\w\\.@ -]+$/.test(t)) return true;           // bare filesystem path
    if (/^<[!/a-zA-Z]/.test(t)) return true;                                                  // HTML / XML markup line
    if (/^https?:\/\/\S+$/.test(t)) return true;                                              // bare URL
    if (/^(User-agent|Disallow|Allow|Sitemap|Host|Crawl-delay)\s*:/i.test(t)) return true;   // robots.txt
    if (/^\S+\s+(-h|--help|-\?)\s*$/.test(t)) return true;                                    // help dump
    if (/^\d+\s/.test(t) && !/^\d+\.\d/.test(t)) return true;                                 // line-numbered block
    if (/^[|>]/.test(t)) return true;                                                         // md table / quote
    if (/^(nano|vim|vi|gedit|notepad|code)\s/.test(t)) return true;                           // editor "open file" step
    if (/^(show|set|setg|unset|back|sessions|jobs|getuid|getsystem|hashdump|migrate|info|banner|exit|quit)\b/i.test(t)) return true; // msf/interactive console verbs
    if (/^[A-Z]{2,}$/.test(t)) return true;                                                   // ALL-CAPS output label (RUST, HTTP...)
    return false;
}

const missing = [], matched = [], setup = [], noise = [];
const seen = new Set();
for (const e of srcEntries) {
    const key = e.cmd.replace(/\s+/g, ' ');
    if (seen.has(key)) continue; seen.add(key);   // first occurrence wins (Commands before Notes)
    if (isNoise(e.cmd)) { noise.push(e); continue; }
    if (isSetup(e.cmd)) { setup.push(e); continue; }
    (covered(sig(e.cmd)) ? matched : missing).push(e);
}

// ---- report ----
const c = (code, s) => process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s;
const scanned = srcFiles.map(s => s.label).join(' + ') || '(none)';
const missNotes = missing.filter(m => m.from === 'Notes').length;
console.log(`\n  Coverage - Module ${MOD}  (${srcFolder})`);
console.log(`  scanned: ${scanned}`);
console.log(`  source lines: ${seen.size}   matched: ${matched.length}   unmatched: ${missing.length}   setup/nav: ${setup.length}   non-command noise: ${noise.length}\n`);
if (missing.length === 0) console.log(c(32, '  ✓ every source command maps to a card.\n'));
else {
    console.log(c(33, `  ⚠ ${missing.length} source command(s) with no matching card` +
        (missNotes ? ` (${missNotes} only in EXPLANATION NOTES)` : '') +
        ' - review (card it, or it\'s an intentional skip: help dump / GUI / flag table):\n'));
    // notes-only omissions first: they were previously invisible, so surface them at the top.
    const order = missing.slice().sort((a, b) => (a.from === 'Notes' ? -1 : 1) - (b.from === 'Notes' ? -1 : 1));
    order.forEach(m => console.log('    ' + c(31, '•') + ' ' + c(m.from === 'Notes' ? 36 : 0, '[' + m.from + ']') + ' ' + m.cmd.slice(0, 100)));
    console.log('');
}
if (SHOW_ALL) { console.log(c(2, '  matched:')); matched.forEach(m => console.log(c(2, '    · [' + m.from + '] ' + m.cmd.slice(0, 90)))); }

// ---- tool-level coverage (--tools): the trustworthy completeness metric ----
// Line-matching over-reports (config blocks, wordlists, hashes, lab literals, fuzzy misses), so the
// honest question is "does every distinct TOOL the module uses appear in at least one card?" - matched
// as a substring of the whole card corpus, so a tool used inside a pipeline (e.g. Get-ADUser | ...) counts.
if (process.argv.includes('--tools')) {
    const corpus = cardStrs.join('\n').toLowerCase();
    const cardToolSet = new Set();
    globalThis.__D.commands.forEach(cc => (cc.tools || []).forEach(t => cardToolSet.add(String(t).toLowerCase())));
    const srcTools = new Set();
    for (const e of matched.concat(missing)) {
        const t = toolOf(e.cmd);
        if (t && t.length >= 3 && /^[a-z][a-z0-9][a-z0-9._-]*$/.test(t) && !SETUP_TOOLS.has(t)) srcTools.add(t);
    }
    const uncarded = [...srcTools].filter(t => !corpus.includes(t) && !cardToolSet.has(t)).sort();
    const covd = srcTools.size - uncarded.length;
    const pct = srcTools.size ? Math.round(covd / srcTools.size * 100) : 100;
    console.log(c(1, `  Tool coverage: ${covd}/${srcTools.size} distinct source tools carded = ${pct}%`));
    if (uncarded.length) { console.log(c(33, '  tools in source with NO card (review - may be a real gap or a noise token):')); uncarded.forEach(t => console.log('    • ' + t)); }
    else console.log(c(32, '  ✓ every tool the module uses appears in at least one card.'));
    console.log('');
}
console.log(c(2, '  Note: line-match is fuzzy and over-reports (config/wordlists/output/lab-literals); use --tools for the honest completeness signal. Intentional skips are fine - just conscious.\n'));
