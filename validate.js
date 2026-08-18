#!/usr/bin/env node
/*
 * validate.js - Schema + completeness validator for the Command Reference.
 *
 * Enforces SCHEMA.md (the FROZEN contract) across every card under commands/.
 * Two layers:
 *   1. HARD ERRORS  - schema violations that break the site/build. MUST be 0.
 *                     (exit code 1 if any are found - safe to gate the build on this.)
 *   2. COMPLETENESS - per-module health so "is this module done?" is answered by the
 *                     tool, not by re-reading files. Warnings only (exit code stays 0).
 *
 * Usage:
 *   node validate.js                 # full report, all modules
 *   node validate.js --module 13     # only cards whose source is "CPTS Module 13..."
 *   node validate.js --errors-only    # hide the completeness table, show only hard errors
 *   node validate.js --json           # machine-readable JSON (for CI / other tools)
 *   node validate.js --strict         # treat completeness gaps as failures too (exit 1)
 *
 * Reads the raw commands/**.json (source of truth), NOT js/commands.js, so it validates
 * before the build and can catch things the build would silently normalize.
 */

const fs = require('fs');
const path = require('path');

// ---------- config from SCHEMA.md ----------
const REQUIRED = ['id', 'name', 'command', 'description', 'platform', 'category', 'subcategory', 'source', 'references'];
const VALID_PLATFORMS = ['linux', 'windows', 'multi'];
const VALID_TYPES = ['command', 'payload', 'script', 'cheatsheet', 'reference', 'attack-chain', 'resource'];
const VALID_OPSEC = ['silent', 'quiet', 'moderate', 'loud'];
const VALID_EXAM = ['exam-ok', 'msf-one-machine', 'restricted', 'lab-only'];
const VALID_REL = ['next', 'alternative', 'prereq', 'escalation', 'cleanup'];
const MITRE_RE = /^T\d{4}(\.\d{3})?$/;   // T1003 or T1003.001
// defense object (SCHEMA.md). All optional strings except `sources` (array). Any other key = typo.
const VALID_DEFENSE_KEYS = ['why_it_works', 'prerequisites', 'detection', 'prevention',
                            'evasion', 'impact', 'artifacts', 'sources',
                            'misconfiguration', 'vulnerable_config', 'secure_config'];
// card types that SHOULD carry defense content (completeness warning, not a hard error)
const DEFENSE_TYPES = ['command', 'payload', 'attack-chain'];

// ---------- args ----------
const args = process.argv.slice(2);
const opt = {
    module: (args.includes('--module') ? args[args.indexOf('--module') + 1] : null),
    errorsOnly: args.includes('--errors-only'),
    json: args.includes('--json'),
    strict: args.includes('--strict'),
};

// ---------- colors (skip if piped/json) ----------
const useColor = process.stdout.isTTY && !opt.json;
const c = (code, s) => useColor ? `\x1b[${code}m${s}\x1b[0m` : s;
const red = s => c(31, s), green = s => c(32, s), yellow = s => c(33, s),
      cyan = s => c(36, s), bold = s => c(1, s), dim = s => c(2, s);

// ---------- load all cards ----------
const commandsDir = path.join(__dirname, 'commands');
const cards = [];       // {file, data}
const parseErrors = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!entry.name.endsWith('.json') || entry.name.startsWith('_')) continue;
        let data;
        try { data = JSON.parse(fs.readFileSync(full, 'utf8')); }
        catch (e) { parseErrors.push({ file: rel(full), msg: e.message }); continue; }
        if (data && data._ignore) continue;   // tombstoned
        cards.push({ file: rel(full), data });
    }
}
function rel(p) { return path.relative(__dirname, p).replace(/\\/g, '/'); }

walk(commandsDir);

// ---------- module key from source string ----------
function moduleOf(card) {
    const s = card.source || '';
    const m = s.match(/Module\s+(\d+)/i);
    return m ? m[1].padStart(2, '0') : '??';
}

// ---------- validation ----------
const errors = [];   // hard schema violations
const idMap = new Map();
const allIds = new Set(cards.map(c => c.data.id).filter(Boolean));

function err(file, id, msg) { errors.push({ file, id: id || '(no id)', msg }); }

for (const { file, data } of cards) {
    const id = data.id;

    // required fields present & non-empty
    for (const f of REQUIRED) {
        const v = data[f];
        const empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
        if (empty) err(file, id, `missing/empty required field: ${f}`);
    }

    // command must be a non-empty string (the integrity guard)
    if (data.command != null && typeof data.command === 'string' && !data.command.trim())
        err(file, id, 'command is empty (renders a blank command bar)');

    // enum validity
    if (data.platform && !VALID_PLATFORMS.includes(data.platform))
        err(file, id, `invalid platform "${data.platform}" (expected linux|windows|multi)`);
    if (data.type && !VALID_TYPES.includes(data.type))
        err(file, id, `invalid type "${data.type}"`);
    if (data.opsec != null && !VALID_OPSEC.includes(data.opsec))
        err(file, id, `invalid opsec "${data.opsec}" (expected silent|quiet|moderate|loud)`);
    if (data.exam != null && !VALID_EXAM.includes(data.exam))
        err(file, id, `invalid exam "${data.exam}" (expected exam-ok|msf-one-machine|restricted|lab-only)`);
    if (data.mitre != null) {
        if (!Array.isArray(data.mitre)) err(file, id, 'mitre must be an array');
        else data.mitre.forEach(t => { if (!MITRE_RE.test(String(t))) err(file, id, `invalid mitre id "${t}" (expected T#### or T####.###)`); });
    }

    // references shape: array of {title,url}
    if (Array.isArray(data.references)) {
        data.references.forEach((r, i) => {
            if (!r || !r.title || !r.url) err(file, id, `references[${i}] missing title/url`);
        });
    }

    // duplicate id
    if (id) {
        if (idMap.has(id)) err(file, id, `duplicate id (also in ${idMap.get(id)})`);
        else idMap.set(id, file);
    }

    // recommended links must point to existing ids; rel (if present) must be valid; no self-links
    (data.recommended || []).forEach(r => {
        if (r && r.id && !allIds.has(r.id)) err(file, id, `broken recommended link -> ${r.id}`);
        if (r && r.id && r.id === id) err(file, id, `recommended points to itself`);
        if (r && r.rel && !VALID_REL.includes(r.rel)) err(file, id, `invalid recommended rel "${r.rel}"`);
    });

    // defense object (SCHEMA.md): if present, must be a well-formed object.
    // Catches the class of bug where enrichment wrote to a mistyped key (e.g. `why`
    // instead of `why_it_works`) and the content silently never rendered.
    if (data.defense != null) {
        if (typeof data.defense !== 'object' || Array.isArray(data.defense)) {
            err(file, id, 'defense must be an object');
        } else {
            for (const k of Object.keys(data.defense)) {
                if (!VALID_DEFENSE_KEYS.includes(k))
                    err(file, id, `unknown defense key "${k}" (won't render; expected one of ${VALID_DEFENSE_KEYS.join(', ')})`);
            }
            // sources[] is mandatory once any defense content exists (citation integrity)
            const hasContent = VALID_DEFENSE_KEYS.some(k => k !== 'sources' && data.defense[k]);
            const src = data.defense.sources;
            if (hasContent && (!Array.isArray(src) || src.length === 0))
                err(file, id, 'defense has content but sources[] is missing/empty (every defense must cite its source)');
            if (src != null && !Array.isArray(src))
                err(file, id, 'defense.sources must be an array of strings');
            // string sub-fields must actually be strings
            for (const k of VALID_DEFENSE_KEYS) {
                if (k === 'sources') continue;
                if (data.defense[k] != null && typeof data.defense[k] !== 'string')
                    err(file, id, `defense.${k} must be a string`);
            }
        }
    }

    // variations / steps / examples shape
    (data.variations || []).forEach((v, i) => {
        if (!v || !v.command || !String(v.command).trim()) err(file, id, `variations[${i}] empty command`);
        // every variation must carry a human label (it becomes the builder's tab name).
        // Without one the UI can only fall back to showing the raw command.
        else if (!v.label || !String(v.label).trim()) err(file, id, `variations[${i}] missing label (add a short "label" - it becomes the tab name)`);
    });
    (data.steps || []).forEach((s, i) => {
        if (!s || !s.command || !String(s.command).trim()) err(file, id, `steps[${i}] empty command`);
    });
}
for (const pe of parseErrors) err(pe.file, null, `INVALID JSON: ${pe.msg}`);

// ---------- command lint: hardcoded lab literals that should be <placeholders> ----------
// The `command` field is a TEMPLATE. Target-specific values (IP, domain, user, ...) must be
// canonical <placeholders>; the concrete lab values belong in `examples`. This lints command +
// variations + steps (NOT examples - those are meant to hold literals). A card can suppress a
// finding it has deliberately accepted via  "lint_ignore": ["hardcoded-literal"].
// Attacker IP ranges -> <lhost>; everything else lab -> <ip>. (HTB/OSCP conventions.)
const ATTACKER_IP = /^(?:10\.10\.1[456]\.|192\.168\.49\.|192\.168\.45\.)/;
const LINT = [
    // [name, regex, default-suggestion] - suggestion may be refined per-match below
    ['lab-cidr',   /\b(?:10|172|192)\.\d{1,3}\.\d{1,3}\.\d{1,3}\/(?:3[0-2]|[12]?\d)\b/g, '<cidr>'],
    ['lab-ip',     /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g, '<ip>'],
    ['lab-domain', /\b(?:inlanefreight(?:\.htb|\.local)?|[a-z0-9-]+\.htb)\b/gi, '<domain>'],
    ['lab-user',   /\b(?:htb-student|cry0l1t3)\b/g, '<user>'],
];
// Only lint what the builder substitutes: command + variations. steps/examples hold literals.
const lintFindings = [];   // {file, id, mod, literal, suggest}
for (const { file, data } of cards) {
    if (opt.module && moduleOf(data) !== opt.module.padStart(2, '0')) continue;
    const ignore = new Set(data.lint_ignore || []);
    if (ignore.has('hardcoded-literal')) continue;
    const fields = [data.command, ...(data.variations || []).map(v => v && v.command)];
    const found = new Map();   // literal -> suggest
    for (const str of fields) {
        if (!str) continue;
        const clean = String(str);
        for (const [name, re, sug] of LINT) {
            re.lastIndex = 0; let m;
            while ((m = re.exec(clean)) !== null) {
                const lit = m[0];
                if (/^127\.|^0\.0\.0\.0/.test(lit)) continue;             // loopback/any = intentional
                let suggest = sug;
                if (name === 'lab-ip' && ATTACKER_IP.test(lit)) suggest = '<lhost>';
                found.set(lit, suggest);
            }
        }
    }
    for (const [lit, sug] of found) lintFindings.push({ file, id: data.id, mod: moduleOf(data), literal: lit, suggest: sug });
}

// ---------- reference hygiene: every card should link its HTB module (where to review) ----------
// Auto-derive each module's HTB Academy id from existing references (majority vote), then flag
// cards in that module that carry NO academy.hackthebox.com link. No manual id list needed.
const HTB_RE = /academy\.hackthebox\.com\/(?:module\/)?(?:details\/)?(\d+)/i;
const modHtbVotes = {};
for (const { data } of cards) {
    const mod = moduleOf(data);
    (data.references || []).forEach(r => {
        const m = r && r.url && String(r.url).match(HTB_RE);
        if (m) { (modHtbVotes[mod] = modHtbVotes[mod] || {})[m[1]] = (modHtbVotes[mod][m[1]] || 0) + 1; }
    });
}
const modHtbId = {};   // module -> expected details id (most common)
for (const [mod, votes] of Object.entries(modHtbVotes)) {
    modHtbId[mod] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
}
const missingHtbRef = [];
for (const { data } of cards) {
    const mod = moduleOf(data);
    if (opt.module && mod !== opt.module.padStart(2, '0')) continue;
    if (!modHtbId[mod]) continue;   // module's id unknown -> can't check
    const hasHtb = (data.references || []).some(r => r && r.url && HTB_RE.test(r.url));
    if (!hasHtb) missingHtbRef.push({ id: data.id, mod });
}

// scope once (module filter) - used by several report sections below
const scopedCards = opt.module ? cards.filter(c => moduleOf(c.data) === opt.module.padStart(2, '0')) : cards;

// ---------- completeness (warnings) per module ----------
const mods = {};
for (const { data } of cards) {
    const mod = moduleOf({ source: data.source });
    if (opt.module && mod !== opt.module.padStart(2, '0')) continue;
    const m = mods[mod] || (mods[mod] = {
        total: 0, noExamples: 0, plainExamples: 0, noNotes: 0, noRec: 0, noTools: 0, noTags: 0,
        defEligible: 0, defMissing: 0
    });
    m.total++;
    const ex = data.examples || [];
    if (ex.length === 0) m.noExamples++;
    else if (ex.some(e => typeof e === 'string')) m.plainExamples++;
    if (!data.notes || !String(data.notes).trim()) m.noNotes++;
    if (!(data.recommended || []).length) m.noRec++;
    if (!(data.tools || []).length) m.noTools++;
    if (!(data.tags || []).length) m.noTags++;
    // defense coverage: only command/payload/attack-chain are eligible (reference/cheatsheet skip)
    if (DEFENSE_TYPES.includes(data.type || 'command')) {
        m.defEligible++;
        const df = data.defense;
        const hasDef = df && typeof df === 'object' &&
                       VALID_DEFENSE_KEYS.some(k => k !== 'sources' && df[k]);
        if (!hasDef) m.defMissing++;
    }
}
// global defense coverage (across scoped cards)
let defEligibleTotal = 0, defCoveredTotal = 0;
for (const { data } of scopedCards) {
    if (!DEFENSE_TYPES.includes(data.type || 'command')) continue;
    defEligibleTotal++;
    const df = data.defense;
    if (df && typeof df === 'object' && VALID_DEFENSE_KEYS.some(k => k !== 'sources' && df[k]))
        defCoveredTotal++;
}

// ---------- placeholder audit (engagement-variable consistency) ----------
// Loads the canonical registry from vars.js and flags any <token> that is NOT a known
// engagement variable. High-frequency unknowns should be canonicalized (add an alias in
// vars.js); one-offs are usually fine as per-command locals. THIS is the future-proof guard:
// when any AI writes <victim_ip> instead of <ip>, it shows up here.
let unknownVars = {};   // token -> count
let varsLoaded = false;
try {
    const { canonVar } = require('./js/vars.js');
    varsLoaded = true;
    const tok = /<([a-zA-Z0-9_\-]+)>/g;
    const scan = s => { let m; while ((m = tok.exec(String(s || ''))) !== null) {
        const t = m[1];
        if (/^(paste|snip|our_|your_)/i.test(t)) continue;   // obvious human placeholders
        if (!canonVar(t)) unknownVars[t] = (unknownVars[t] || 0) + 1;
    } };
    for (const { data } of cards) {
        if (opt.module && moduleOf(data) !== opt.module.padStart(2, '0')) continue;
        scan(data.command);
        (data.variations || []).forEach(v => scan(v.command));
        (data.steps || []).forEach(v => scan(v.command));
        (data.examples || []).forEach(e => scan(typeof e === 'string' ? e : e && e.command));
    }
} catch (e) { /* vars.js absent -> skip audit */ }

// ---------- group audit (category tree consistency) ----------
// Loads js/groups.js and flags any (category, subcategory) that IS in a grouped category but was
// never assigned a group there - i.e. it silently falls into the "Other" fallback bucket in the
// tree. This stops the nav tree from accumulating orphan links as new subcategories appear.
let unmappedSubcats = [];   // [{cat, sub, ids:[...]}]
try {
    const win = {}; global.window = win;
    new Function(fs.readFileSync(path.join(__dirname, 'js', 'groups.js'), 'utf8'))();
    if (typeof win.isSubcatMapped === 'function') {
        const bucket = {};   // "cat|sub" -> {cat, sub, ids:[]}
        for (const { data } of scopedCards) {
            const cat = data.category || 'Other', sub = data.subcategory || 'General';
            if (win.categoryIsGrouped(cat) && !win.isSubcatMapped(cat, sub)) {
                const k = cat + '|' + sub;
                (bucket[k] = bucket[k] || { cat, sub, ids: [] }).ids.push(data.id);
            }
        }
        unmappedSubcats = Object.values(bucket);
    }
} catch (e) { /* groups.js absent -> skip audit */ }

// ---------- module completeness scoring ----------
function score(m) {
    // weighted: examples captioned + notes + chains + tools tagged
    const exOK = m.total - m.noExamples - m.plainExamples;
    const parts = [
        (m.total - m.noExamples) / m.total,        // has examples
        exOK / m.total,                            // captioned examples
        (m.total - m.noNotes) / m.total,           // has notes
        (m.total - m.noRec) / m.total,             // has chains
        (m.total - m.noTools) / m.total,           // has tools
    ];
    return Math.round(100 * parts.reduce((a, b) => a + b, 0) / parts.length);
}

// ---------- output ----------
if (opt.json) {
    console.log(JSON.stringify({
        totalCards: cards.length,
        hardErrors: errors,
        modules: Object.fromEntries(Object.entries(mods).map(([k, m]) => [k, { ...m, score: score(m) }])),
        unknownPlaceholders: Object.entries(unknownVars).sort((a, b) => b[1] - a[1]).map(([token, count]) => ({ token, count })),
        commandLint: lintFindings,
    }, null, 2));
    process.exit(errors.length ? 1 : 0);
}

console.log(bold(`\n  Command Reference - Validation Report`));
console.log(dim(`  ${cards.length} active cards scanned` + (opt.module ? ` (module ${opt.module} filter)` : '')) + '\n');

// hard errors
if (errors.length) {
    console.log(red(bold(`  ✗ ${errors.length} HARD ERROR(S) - these break the site/build:\n`)));
    const byFile = {};
    errors.forEach(e => (byFile[e.file] = byFile[e.file] || []).push(e));
    for (const [file, list] of Object.entries(byFile)) {
        console.log(`    ${cyan(file)}`);
        list.forEach(e => console.log(`      ${red('•')} ${e.msg}  ${dim('[' + e.id + ']')}`));
    }
    console.log('');
} else {
    console.log(green(bold(`  ✓ 0 hard errors - schema is clean.\n`)));
}

// completeness table
if (!opt.errorsOnly) {
    console.log(bold(`  Completeness by module`) + dim('  (gaps are warnings, not failures)'));
    console.log(dim(`  Mod  Cards  NoEx  PlainEx  NoNotes  NoChain  NoTools   Def       Score`));
    console.log(dim(`  ${'-'.repeat(72)}`));
    const keys = Object.keys(mods).sort();
    for (const k of keys) {
        const m = mods[k];
        const sc = score(m);
        const scStr = sc >= 90 ? green(sc + '%') : sc >= 70 ? yellow(sc + '%') : red(sc + '%');
        const w = (n, pad) => String(n).padStart(pad);
        // defense coverage for the module's eligible (command/payload/attack-chain) cards
        const defCov = m.defEligible - m.defMissing;
        let defStr;
        if (m.defEligible === 0) defStr = dim('  -  ');
        else {
            const dp = Math.round(100 * defCov / m.defEligible);
            const raw = `${defCov}/${m.defEligible}`;
            defStr = (dp === 100 ? green : dp >= 40 ? yellow : red)(raw);
        }
        console.log(`  ${k.padEnd(4)} ${w(m.total,5)}  ${w(m.noExamples,4)}  ${w(m.plainExamples,7)}  ${w(m.noNotes,7)}  ${w(m.noRec,7)}  ${w(m.noTools,7)}   ${defStr.padEnd(9)} ${scStr}`);
    }
    console.log('');
    console.log(dim(`  NoEx=no examples · PlainEx=uncaptioned examples · NoChain=no recommended links`));
    console.log(dim(`  Def = defense-populated / eligible (command·payload·attack-chain) cards in the module`));
    console.log(dim(`  Score = avg of (has-examples, captioned, has-notes, has-chains, has-tools)\n`));
}

// command lint report
if (!opt.errorsOnly) {
    if (lintFindings.length === 0) {
        console.log(green(`  ✓ Command lint: no hardcoded lab literals - every command is a clean template.\n`));
    } else {
        const byMod = {};
        lintFindings.forEach(f => (byMod[f.mod] = byMod[f.mod] || []).push(f));
        console.log(bold(`  Command lint`) + red(`  ${lintFindings.length} hardcoded literal(s)`) + dim(` that should be <placeholders> (or lint_ignore'd)`));
        for (const mod of Object.keys(byMod).sort()) {
            const list = byMod[mod];
            console.log(`    ${cyan('Module ' + mod)} ${dim('(' + list.length + ')')}`);
            list.slice(0, 12).forEach(f => console.log(`      ${red('•')} ${f.literal} ${dim('->')} ${f.suggest}  ${dim('[' + f.id + ']')}`));
            if (list.length > 12) console.log(dim(`      ...and ${list.length - 12} more`));
        }
        console.log(dim(`  Fix: replace the literal with the placeholder in command/variations/steps; keep the`));
        console.log(dim(`  concrete value in examples. If intentional, add "lint_ignore": ["hardcoded-literal"].\n`));
    }
}

// reference hygiene
if (!opt.errorsOnly) {
    if (missingHtbRef.length === 0) {
        console.log(green(`  ✓ Reference hygiene: every card links its HTB module.\n`));
    } else {
        const byMod = {};
        missingHtbRef.forEach(f => (byMod[f.mod] = byMod[f.mod] || []).push(f.id));
        console.log(bold(`  Reference hygiene`) + yellow(`  ${missingHtbRef.length} card(s) missing their HTB module link`) + dim(` (the "where to review if stuck" ref)`));
        for (const m of Object.keys(byMod).sort()) console.log(`      Module ${m} ${dim('(expect details/' + modHtbId[m] + ')')}: ${byMod[m].slice(0, 8).join(', ')}${byMod[m].length > 8 ? ' ...' : ''}`);
        console.log('');
    }
}

// chain coverage: how many cards have an outgoing recommended link, by category
if (!opt.errorsOnly) {
    const catTot = {}, catRec = {};
    for (const { data } of scopedCards) {
        const c = data.category || '?';
        catTot[c] = (catTot[c] || 0) + 1;
        if ((data.recommended || []).length) catRec[c] = (catRec[c] || 0) + 1;
    }
    const totalRec = Object.values(catRec).reduce((a, b) => a + b, 0);
    const pct = (n, d) => d ? Math.round(100 * n / d) + '%' : '0%';
    console.log(bold(`  Chain coverage`) + dim(`  (cards with a "recommended next" link)`));
    console.log(`    overall: ${totalRec}/${scopedCards.length} ${dim('(' + pct(totalRec, scopedCards.length) + ')')}`);
    const weak = Object.keys(catTot).filter(c => (catRec[c] || 0) / catTot[c] < 0.25).sort();
    if (weak.length) console.log(yellow(`    weakest: ` + weak.map(c => `${c} ${pct(catRec[c] || 0, catTot[c])}`).join(' · ')));
    console.log('');
}

// placeholder audit
if (!opt.errorsOnly && varsLoaded) {
    const entries = Object.entries(unknownVars).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
        console.log(green(`  ✓ Placeholder audit: every <token> is a known engagement variable.\n`));
    } else {
        const high = entries.filter(([, n]) => n >= 3);
        console.log(bold(`  Placeholder audit`) + dim(`  (tokens not in vars.js - review, don't panic)`));
        if (high.length) {
            console.log(yellow(`  ⚠ ${high.length} token(s) used 3+ times but NOT canonical - likely should be renamed or aliased in vars.js:`));
            high.forEach(([t, n]) => console.log(`      ${yellow('•')} <${t}>  ${dim('×' + n)}`));
        }
        const low = entries.length - high.length;
        console.log(dim(`  ${low} more one-off token(s) (likely legit per-command locals). Run --json to see all.\n`));
    }
}

// group audit (category tree)
if (!opt.errorsOnly) {
    if (unmappedSubcats.length === 0) {
        console.log(green(`  ✓ Group audit: every subcategory in a grouped category maps to a tree group.\n`));
    } else {
        console.log(bold(`  Group audit`) + yellow(`  ${unmappedSubcats.length} subcategory(ies) fall into the "Other" fallback`) + dim(` - add them to js/groups.js:`));
        unmappedSubcats.forEach(u => console.log(`      ${yellow('•')} [${u.cat}] "${u.sub}"  ${dim('×' + u.ids.length)}`));
        console.log('');
    }
}

// opsec / mitre coverage. opsec is REQUIRED on every card (warn + strict-fail if missing);
// mitre is encouraged.
const missingOpsec = scopedCards.filter(c => !c.data.opsec);
if (!opt.errorsOnly) {
    const withOpsec = scopedCards.length - missingOpsec.length;
    const withMitre = scopedCards.filter(c => (c.data.mitre || []).length).length;
    const pct = n => scopedCards.length ? Math.round(100 * n / scopedCards.length) + '%' : '0%';
    console.log(bold(`  Field coverage`));
    const opsecStr = missingOpsec.length ? yellow(`${withOpsec}/${scopedCards.length} (${pct(withOpsec)})`) : green(`${withOpsec}/${scopedCards.length} (100%)`);
    console.log(`    opsec (required): ${opsecStr}   mitre (encouraged): ${withMitre}/${scopedCards.length} ${dim('(' + pct(withMitre) + ')')}`);
    const defPct = defEligibleTotal ? Math.round(100 * defCoveredTotal / defEligibleTotal) : 0;
    const defColor = defPct >= 90 ? green : defPct >= 40 ? yellow : dim;
    console.log(`    defense (command/payload/chain): ${defColor(defCoveredTotal + '/' + defEligibleTotal + ' (' + defPct + '%)')}   ${dim('reference/cheatsheet/script skip')}`);
    // --strict: list eligible cards missing defense (the per-module "not shipped half-done" gate)
    if (opt.strict && defCoveredTotal < defEligibleTotal) {
        const miss = scopedCards.filter(c => DEFENSE_TYPES.includes(c.data.type || 'command') &&
            !(c.data.defense && typeof c.data.defense === 'object' &&
              VALID_DEFENSE_KEYS.some(k => k !== 'sources' && c.data.defense[k])));
        const byMod = {};
        miss.forEach(c => (byMod[moduleOf(c.data)] = byMod[moduleOf(c.data)] || []).push(c.data.id));
        console.log(red(`    ✗ --strict: ${miss.length} eligible card(s) missing defense:`));
        for (const m of Object.keys(byMod).sort())
            console.log(`      Module ${m}: ${byMod[m].slice(0, 8).join(', ')}${byMod[m].length > 8 ? ' ...' : ''}`);
    }
    if (missingOpsec.length) {
        const byMod = {};
        missingOpsec.forEach(c => (byMod[moduleOf(c.data)] = byMod[moduleOf(c.data)] || []).push(c.data.id));
        console.log(yellow(`    ⚠ ${missingOpsec.length} card(s) missing opsec - set silent|quiet|moderate|loud:`));
        for (const m of Object.keys(byMod).sort()) console.log(`      Module ${m}: ${byMod[m].slice(0, 8).join(', ')}${byMod[m].length > 8 ? ' ...' : ''}`);
    }
    console.log('');
}

// summary line
const total = cards.length;
const strictGaps = [];
if (opt.strict) {
    if (lintFindings.length > 0) strictGaps.push(`${lintFindings.length} hardcoded literal(s)`);
    if (missingOpsec.length > 0) strictGaps.push(`${missingOpsec.length} missing opsec`);
    if (defCoveredTotal < defEligibleTotal) strictGaps.push(`${defEligibleTotal - defCoveredTotal} missing defense`);
    if (unmappedSubcats.length > 0) strictGaps.push(`${unmappedSubcats.length} unmapped subcat(s)`);
    const lowMods = Object.values(mods).filter(m => score(m) < 90).length;
    if (lowMods > 0) strictGaps.push(`${lowMods} module(s) <90% score`);
}
const fail = errors.length > 0 || strictGaps.length > 0;

if (errors.length > 0)
    console.log(red(`  RESULT: FAIL`) + dim(` — ${errors.length} hard error(s) to fix.\n`));
else if (strictGaps.length > 0)
    console.log(yellow(`  RESULT: STRICT FAIL`) + dim(` — schema clean, but --strict gaps: ${strictGaps.join(', ')}.\n`));
else
    console.log(green(`  RESULT: PASS`) + dim(` — ${total} cards, no schema violations.\n`));

process.exit(fail ? 1 : 0);
