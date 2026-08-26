#!/usr/bin/env node
/*
 * healthcheck.js - whole-library render/click sweep (the "click a lot" automation).
 *
 * validate.js checks the SCHEMA of each card in isolation. This checks how the cards actually
 * BEHAVE in the builder when you click through them - the class of bug that shows a wrong or
 * empty command bar even though the JSON is schema-valid. Run it after any bulk edit, or anytime
 * you want reassurance that every card + every variation tab renders and fills correctly.
 *
 *   node healthcheck.js            # fast data-level sweep (no dependencies)
 *   node healthcheck.js --render   # ALSO headless-render every card + every tab via jsdom
 *
 * Exit code is 1 if any HARD issue is found (param-parse bug, empty command, render crash),
 * 0 otherwise. "Redundant" and "identical-to-default" are warnings (exit stays 0).
 *
 * What it catches (and why it matters):
 *   1. PARAM-PARSE BUG ("No parameters for this command" with parameters present). The builder
 *      only substitutes tokens matching <[A-Za-z0-9_-]+> (word chars + hyphen). A placeholder
 *      with a dot/colon/dollar/slash/space - <passwords.txt>, <SafetyKatz.exe>, <gmsa$>,
 *      <LM:NT_hash> - is invisible to it: never a parameter, never filled, shown literally. A
 *      command that hardcodes a literal (domain.com) instead of <domain> has the same symptom.
 *   2. EMPTY COMMAND - a blank command bar.
 *   3. DUP VARIATION LABELS - two tabs with the same name (validate.js also hard-errors on this;
 *      repeated here so one command gives the whole picture).
 *   4. IDENTICAL-TO-DEFAULT - a variation whose command byte-matches the default (redundant tab).
 *   5. (--render) RENDER CRASH - any JS exception thrown while rendering a card or switching to
 *      one of its variation tabs.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

// ---- load COMMAND_DATA exactly as the site does (generated bundle) ----
const bundle = path.join(ROOT, 'js', 'commands.js');
if (!fs.existsSync(bundle)) { console.error('js/commands.js missing - run: node build-commands.js'); process.exit(2); }
require('vm').runInThisContext(fs.readFileSync(bundle, 'utf8') + '\nglobalThis.__CR = COMMAND_DATA;');
// COMMAND_DATA is { commands:[...], totalCommands, ... } - the cards live under .commands
const CARDS = Array.isArray(globalThis.__CR) ? globalThis.__CR : (globalThis.__CR && globalThis.__CR.commands) || [];

// ---- the "botched parameter" detector (identical to validate.js FILENAME_PH) ----
// A fillable parameter is <word-chars-or-hyphen>. This flags a token that LOOKS like an intended
// parameter (starts with a letter, word-like) but carries a . : or $ the builder can't parse -
// e.g. <passwords.txt>, <SafetyKatz.exe>, <gmsa$>, <LM:NT_hash>. It deliberately does NOT match
// legitimate payload/HTML literals like <?php ... ?>, </script>, <%= 7*7 %>, <&5, <exploit|post>,
// which are meant to be literal and correctly show no parameter field. Keep this in sync with the
// FILENAME_PH constant in validate.js.
const FILENAME_PH = /<[a-zA-Z][a-zA-Z0-9_-]*[.:$][a-zA-Z0-9_.:$-]*>/g;

const hard = [];   // botched placeholder / empty command  (exit 1)
const dup  = [];   // duplicate variation labels           (exit 1 - also a validate.js error)
const redun = [];  // variation identical to default       (warning)

for (const c of CARDS) {
    if (!c || !c.id) continue;
    const slots = [['command', c.command]];
    (c.variations || []).forEach((v, i) => slots.push([`variations[${i}]`, v && v.command]));
    (c.steps || []).forEach((s, i) => slots.push([`steps[${i}]`, s && s.command]));

    for (const [where, cmd] of slots) {
        const s = String(cmd || '').trim();
        if (!s) { hard.push(`${c.id}: ${where} EMPTY command`); continue; }
        const bad = s.match(FILENAME_PH) || [];
        if (bad.length) hard.push(`${c.id}: ${where} unparseable placeholder(s) ${bad.join(' ')} - looks like a parameter but has a . : or $; rename to a clean <token>`);
    }

    // duplicate variation labels
    const seen = new Map();
    (c.variations || []).forEach((v, i) => {
        const l = v && v.label ? String(v.label).trim() : '';
        if (!l) return;
        if (seen.has(l)) dup.push(`${c.id}: variations[${i}] duplicate label "${l}" (also [${seen.get(l)}])`);
        else seen.set(l, i);
    });

    // variation identical to the default command
    const def = String(c.command || '').trim();
    (c.variations || []).forEach((v, i) => {
        if (v && String(v.command || '').trim() === def && def) redun.push(`${c.id}: variations[${i}] is byte-identical to Default (redundant tab)`);
    });
}

// ---- optional: real headless render sweep ----
let renderCrashes = [];
let rendered = 0;
if (process.argv.includes('--render')) {
    let JSDOM;
    try { ({ JSDOM } = require('jsdom')); } catch (e) {
        console.error('--render needs jsdom (npm i jsdom). Skipping render sweep.'); JSDOM = null;
    }
    if (JSDOM) {
        const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'),
            { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
        const { window } = dom; global.window = window; global.document = window.document;
        global.localStorage = { _s: {}, getItem(k){return this._s[k]||null}, setItem(k,v){this._s[k]=v}, removeItem(k){delete this._s[k]} };
        try { Object.defineProperty(window, 'localStorage', { value: global.localStorage, configurable: true }); } catch (e) { /* jsdom already provides one */ }
        if (!window.navigator.clipboard) Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: () => Promise.resolve() }, configurable: true });
        try { Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true }); } catch (e) { /* Node >=21 provides a read-only navigator; app.js reads window.navigator anyway */ }
        // jsdom lacks IntersectionObserver (used for lazy-render sentinels) - stub it so init() doesn't throw.
        const NoopObserver = class { observe(){} unobserve(){} disconnect(){} takeRecords(){ return []; } };
        window.IntersectionObserver = NoopObserver;
        global.IntersectionObserver = NoopObserver;
        // commands.js was already evaluated at the top of this file (its `const COMMAND_DATA`
        // persists in the vm context and is visible to app.js), so only load the rest here.
        for (const f of ['vars.js', 'groups.js', 'app.js']) {
            const p = path.join(ROOT, 'js', f);
            if (fs.existsSync(p)) require('vm').runInThisContext(fs.readFileSync(p, 'utf8'));
        }
        window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
        const app = window.app;
        for (const card of app.commands) {
            try {
                app.selectCommand(card);
                const n = (card.variations || []).length;
                for (let t = 0; t <= n; t++) { app.authTab = t; app.renderBuilder(); rendered++; }
            } catch (e) {
                renderCrashes.push(`${card.id}: ${e.message}`);
            }
        }
    }
}

// ---- report ----
const line = '-'.repeat(60);
console.log('\n  Command Reference - Health Check');
console.log(`  ${CARDS.length} cards\n${line}`);
const block = (title, arr, cap = 30) => {
    console.log(`  ${title}: ${arr.length}`);
    arr.slice(0, cap).forEach(m => console.log('     - ' + m));
    if (arr.length > cap) console.log(`     ... +${arr.length - cap} more`);
};
block('HARD  botched-placeholder / empty-command issues', hard);
block('HARD  duplicate variation labels', dup);
block('WARN  variation identical to default (redundant tab)', redun);
if (process.argv.includes('--render')) block('HARD  render crashes', renderCrashes);
if (process.argv.includes('--render')) console.log(`  (headless-rendered ${rendered} card/tab views)`);

const hardCount = hard.length + dup.length + renderCrashes.length;
console.log(line);
if (hardCount === 0) console.log(`  RESULT: PASS - no behavioural issues${redun.length ? ` (${redun.length} redundant-tab warnings)` : ''}.\n`);
else console.log(`  RESULT: FAIL - ${hardCount} hard issue(s) to fix.\n`);
process.exit(hardCount ? 1 : 0);
