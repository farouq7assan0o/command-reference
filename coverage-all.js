#!/usr/bin/env node
/*
 * coverage-all.js - tool-level coverage across ALL FIVE certs, not just CPTS.
 *
 * The original coverage.js is hardcoded to the CPTS notes folder and only answers "did the CPTS
 * cards capture everything." That left CWES / OSCP / CDSA / CRTP with NO automated coverage gate -
 * which is how the CRTP PowerView enumeration set drifted for a while. This tool closes that: it
 * extracts distinct tool tokens (Verb-Noun cmdlets, *.exe binaries, module::verb) from each cert's
 * PRIMARY source (Markdown + HTML) and diffs them against the whole card corpus.
 *
 * It is the trustworthy completeness signal (like coverage.js --tools), NOT a factual-correctness
 * check. A residual "uncarded" token is usually noise (lab hostnames, config directives, C keywords,
 * variable names) - triage each: a distinct tool/technique -> card it; a target/label/keyword -> skip.
 *
 *   node coverage-all.js                 # all certs whose source path exists on this machine
 *   node coverage-all.js --only crtp     # one cert (cpts|cwes|oscp|cdsa|crtp)
 *   node coverage-all.js --list          # list uncarded tokens per cert (default: counts only)
 *   node coverage-all.js --json
 *
 * Source paths are machine-local (they live outside the repo). Edit SOURCES below, or set an env
 * override e.g.  CR_SRC_CRTP="D:\\path\\to\\AD"  node coverage-all.js --only crtp
 * A cert whose source folder is not present is skipped with a note (so this still runs anywhere).
 *
 * PDF sources (the CRTP slides/slidenotes) are NOT parsed here - use source-scan.py for those.
 */
const fs = require('fs'), path = require('path');

// ---- machine-local source roots (override via env CR_SRC_<CERT>) ----
const SOURCES = {
    cpts: process.env.CR_SRC_CPTS || 'D:/Security/CPTS FULL',
    cwes: process.env.CR_SRC_CWES || 'D:/Security/CWES FULL',
    cdsa: process.env.CR_SRC_CDSA || 'D:/Security/CDSA materials',
    crtp: process.env.CR_SRC_CRTP || 'D:/Downloads/Active Directory/Active Directory',
    oscp: process.env.CR_SRC_OSCP || 'D:/Downloads/O 2/OffSec - PEN-200 Book 2024.11 hide01.ir'
};
const EXTS = ['.md', '.html', '.htm', '.mhtml'];

const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const ONLY = arg('--only');
const LIST = process.argv.includes('--list');
const JSON_OUT = process.argv.includes('--json');
const col = (n, s) => process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s;

// ---- build the corpus text (everything, lowercased) for substring "is it carded" checks ----
const corpus = fs.readFileSync(path.join(__dirname, 'js', 'commands.js'), 'utf8').toLowerCase();
const carded = tok => corpus.includes(tok.toLowerCase());

// ---- walk a source dir, collecting command-ish lines from md fences/tables + html code blocks ----
function walk(dir, out) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
        if (e.name === '.obsidian' || e.name === 'images' || e.name.startsWith('.')) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (!/\/Theory\//.test(full.replace(/\\/g, '/'))) walk(full, out); }
        else if (EXTS.includes(path.extname(e.name).toLowerCase())) out.push(full);
    }
}
function decodeEnt(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}
function extractLines(file) {
    const txt = fs.readFileSync(file, 'utf8');
    const ext = path.extname(file).toLowerCase();
    const lines = [];
    if (ext === '.md') {
        let inFence = false;
        for (const ln of txt.split(/\r?\n/)) {
            if (ln.trim().startsWith('```')) { inFence = !inFence; continue; }
            if (inFence && ln.trim() && !ln.trim().startsWith('#')) lines.push(ln.trim());
        }
        // markdown table cells:  | `cmd` | ...   and inline `code`
        let m;
        const reCell = /^\|\s*`([^`]+)`/gm; while ((m = reCell.exec(txt))) lines.push(m[1].trim());
        const reInline = /`([^`\n]{3,200})`/g; while ((m = reInline.exec(txt))) lines.push(m[1].trim());
    } else {
        // html / mhtml: pull <code>/<pre> blocks
        let m;
        const re = /<(?:code|pre)[^>]*>([\s\S]*?)<\/(?:code|pre)>/gi;
        while ((m = re.exec(txt))) {
            const inner = decodeEnt(m[1].replace(/<[^>]+>/g, ' '));
            for (const ln of inner.split(/\r?\n/)) if (ln.trim()) lines.push(ln.trim());
        }
    }
    return lines;
}

function tokens(lines) {
    const cmdlets = new Set(), exes = new Set(), verbs = new Set();
    for (const c of lines) {
        let m;
        const r1 = /\b([A-Z][a-zA-Z]+-[A-Z][a-zA-Z0-9]+)\b/g; while ((m = r1.exec(c))) cmdlets.add(m[1]);
        const r2 = /\b([\w-]+\.exe)\b/g; while ((m = r2.exec(c))) exes.add(m[1].toLowerCase());
        const r3 = /\b([a-z]+::[a-z0-9-]+)\b/g; while ((m = r3.exec(c.toLowerCase()))) verbs.add(m[1]);
    }
    return { cmdlets, exes, verbs };
}

const certs = ONLY ? [ONLY] : Object.keys(SOURCES);
const report = {};
for (const cert of certs) {
    const root = SOURCES[cert];
    if (!root || !fs.existsSync(root)) { report[cert] = { skipped: true, root }; continue; }
    const files = []; walk(root, files);
    const lines = files.flatMap(extractLines);
    const t = tokens(lines);
    const groups = {};
    for (const [name, set] of [['cmdlets', t.cmdlets], ['exes', t.exes], ['module::verb', t.verbs]]) {
        const uncarded = [...set].filter(x => !carded(x)).sort();
        groups[name] = { total: set.size, uncarded };
    }
    report[cert] = { files: files.length, lines: lines.length, groups };
}

if (JSON_OUT) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }

console.log('\n  Command Reference - Tool Coverage (all certs)');
console.log('  corpus: js/commands.js   |   trustworthy tool-level signal (not a correctness check)');
console.log('='.repeat(64));
for (const cert of certs) {
    const r = report[cert];
    if (!r) continue;
    if (r.skipped) { console.log('\n  ' + cert.toUpperCase() + '  - source not found (skipped): ' + r.root); continue; }
    console.log('\n  ' + col(1, cert.toUpperCase()) + '   ' + r.files + ' files, ' + r.lines + ' source lines');
    for (const [name, g] of Object.entries(r.groups)) {
        const carded_n = g.total - g.uncarded.length;
        const pct = g.total ? Math.round(carded_n / g.total * 100) : 100;
        const c = pct >= 95 ? 32 : pct >= 85 ? 33 : 31;
        console.log('    ' + col(c, name.padEnd(14) + carded_n + '/' + g.total + ' carded (' + pct + '%)'));
        if (LIST && g.uncarded.length) g.uncarded.forEach(x => console.log('        - ' + x));
    }
}
console.log('\n  Residual uncarded tokens are usually noise (lab hostnames, config keys, variables,');
console.log('  C keywords). Triage each: distinct tool/technique -> card it; label/target -> skip.');
console.log('  `--list` shows them; `source-scan.py` also handles the PDF slide sources.\n');
