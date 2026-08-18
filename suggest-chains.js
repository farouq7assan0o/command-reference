#!/usr/bin/env node
/*
 * suggest-chains.js - propose "recommended next" candidates for cards that have none.
 *
 * For each card in a module with an empty `recommended`, ranks other cards as likely next steps
 * using: same service/subcategory, shared tools/tags, and forward phase progression
 * (Enumeration -> Exploitation -> Privesc -> Post-Ex -> Lateral). Prints the top few with a
 * reason so you (or an AI) can add the good ones. It SUGGESTS - it never writes; chain logic
 * needs human judgment.
 *
 * Usage:  node suggest-chains.js --module 04
 *         node suggest-chains.js --module 04 --top 5
 */
const fs = require('fs'), path = require('path');
const arg = n => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const MOD = (arg('--module') || '').padStart(2, '0');
const TOP = parseInt(arg('--top') || '3', 10);
if (!MOD || MOD === '00') { console.error('usage: node suggest-chains.js --module NN [--top 3]'); process.exit(2); }

require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, 'js', 'commands.js'), 'utf8') + ';globalThis.__D=COMMAND_DATA;');
const cards = globalThis.__D.commands;
const modOf = c => (String(c.source || '').match(/Module\s+(\d+)/) || [])[1];

const PHASE = { 'Enumeration': 0, 'Web Enumeration': 0, 'Fundamentals': 0, 'Vulnerability Assessment': 1, 'Exploitation': 2, 'Web Exploitation': 2, 'Password Attacks': 2, 'File Transfers': 2, 'Post-Exploitation': 3, 'Pivoting & Tunneling': 3, 'Privilege Escalation': 4, 'Lateral Movement': 5, 'Reporting': 6 };
const setOf = a => new Set((a || []).map(x => String(x).toLowerCase()));
const inter = (a, b) => { let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n; };

function score(S, T) {
    if (T.id === S.id) return { s: -1 };
    let s = 0; const why = [];
    const st = setOf(S.tools), tt = setOf(T.tools);
    const sg = setOf(S.tags), tg = setOf(T.tags);
    if (S.category === T.category && S.subcategory === T.subcategory) { s += 3; why.push('same service'); }
    if (inter(st, tt)) { s += 2; why.push('shared tool'); }
    if (inter(sg, tg)) { s += 2; why.push('shared tag'); }
    const ps = PHASE[S.category] ?? 9, pt = PHASE[T.category] ?? 9;
    if (pt === ps + 1) { s += 2; why.push('next phase'); }
    else if (pt === ps) { s += 1; }
    else if (pt > ps) { s += 1; why.push('later phase'); }
    return { s, why };
}

const dim = s => process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s;
const empties = cards.filter(c => modOf(c) === MOD && !(c.recommended || []).length);
console.log(`\n  Chain suggestions - Module ${MOD}   (${empties.length} card(s) with no recommended)\n`);
if (!empties.length) { console.log('  nothing to suggest - every card already has a chain.\n'); process.exit(0); }

for (const S of empties) {
    const ranked = cards.map(T => ({ T, ...score(S, T) })).filter(x => x.s >= 3)
        .sort((a, b) => b.s - a.s).slice(0, TOP);
    if (!ranked.length) continue;
    console.log(`  ${S.id}  ${dim('(' + S.category + ' > ' + S.subcategory + ')')}`);
    ranked.forEach(r => console.log(`      -> ${r.T.id}  ${dim('[' + r.why.join(', ') + ']')}`));
    console.log('');
}
console.log(dim('  Add the good ones as {"id": "...", "note": "why-next", "rel": "next|escalation|alternative|prereq"}.') + '\n');
