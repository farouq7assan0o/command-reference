#!/usr/bin/env node
/*
 * chain-health.js - find attack cards whose recommended-chain is incomplete, so the Attack-Path
 * Map and Study chains get richer over time. This is an AID (like coverage.js), not a hard gate:
 * some cards legitimately have no next step (a root shell, a report step) or no predecessor (an
 * entry-point recon/enumeration card). It flags the ones where a link is *usually* expected.
 *
 *   node chain-health.js            # summary + the prioritised dead-end list
 *   node chain-health.js --all      # also list no-predecessor cards in attack categories
 *
 * Definitions (same semantics as the Attack-Path Map):
 *   forward (comes after)  = own recommended[next|escalation] + cards that list THIS as a prereq
 *   backward (comes before) = own recommended[prereq] + cards that recommend THIS as next/escalation
 */
const fs = require('fs'), path = require('path');
require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, 'js', 'commands.js'), 'utf8') + ';globalThis.__D=COMMAND_DATA;');
const cards = globalThis.__D.commands.filter(c => c && c.id);
const byId = {}; cards.forEach(c => byId[c.id] = c);
const rev = {};
cards.forEach(c => (c.recommended || []).forEach(r => { if (r && r.id) (rev[r.id] = rev[r.id] || []).push({ id: c.id, rel: r.rel }); }));
const FWD = new Set(['next', 'escalation']);
const fwd = id => {
    const s = new Set();
    (byId[id].recommended || []).forEach(r => { if (r.id && byId[r.id] && r.rel !== 'prereq' && r.rel !== 'alternative') s.add(r.id); });
    (rev[id] || []).forEach(x => { if (byId[x.id] && x.rel === 'prereq') s.add(x.id); });
    return s;
};
const back = id => {
    const s = new Set();
    (byId[id].recommended || []).forEach(r => { if (r.id && byId[r.id] && r.rel === 'prereq') s.add(r.id); });
    (rev[id] || []).forEach(x => { if (byId[x.id] && FWD.has(x.rel || 'next')) s.add(x.id); });
    return s;
};

// categories where a card is an ATTACK step that usually has a follow-on (so a dead-end is a gap).
// Enumeration/Recon/Reporting/Fundamentals and blue-team categories are legit terminals/entry points.
const ATTACK_CATS = new Set(['Exploitation', 'Privilege Escalation', 'Lateral Movement', 'Credential Access',
    'Active Directory', 'Web Exploitation', 'Password Attacks', 'Pivoting & Tunneling']);
const ATTACK_TYPES = new Set(['command', 'payload', 'attack-chain']);
const isAttack = c => ATTACK_TYPES.has(c.type || 'command') && ATTACK_CATS.has(c.category || '');

const deadEnds = [], noPred = [];
for (const c of cards) {
    if (!isAttack(c)) continue;
    if (fwd(c.id).size === 0) deadEnds.push(c);
    if (back(c.id).size === 0) noPred.push(c);
}
const byCat = arr => { const m = {}; arr.forEach(c => (m[c.category] = m[c.category] || []).push(c.id)); return m; };

const c = (code, s) => process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s;
console.log(`\n  Chain health — ${cards.length} cards (${cards.filter(isAttack).length} attack-type)\n`);
console.log(c(33, `  DEAD-ENDS: ${deadEnds.length} attack cards with NO forward step (add a next/escalation where one exists):`));
const de = byCat(deadEnds);
for (const cat of Object.keys(de).sort((a, b) => de[b].length - de[a].length))
    console.log('    ' + String(de[cat].length).padStart(3) + '  ' + cat + '  ' + c(2, '→ ' + de[cat].slice(0, 6).join(', ') + (de[cat].length > 6 ? ' …' : '')));
if (process.argv.includes('--all')) {
    console.log('\n' + c(36, `  NO-PREDECESSOR: ${noPred.length} attack cards nothing leads to (add a prereq from the enum/foothold that reaches it):`));
    const np = byCat(noPred);
    for (const cat of Object.keys(np).sort((a, b) => np[b].length - np[a].length))
        console.log('    ' + String(np[cat].length).padStart(3) + '  ' + cat + '  ' + c(2, '→ ' + np[cat].slice(0, 6).join(', ') + (np[cat].length > 6 ? ' …' : '')));
}
console.log(c(2, '\n  Aid, not a gate: a real root shell / report step is a legit dead-end. Fill the ones where a next step obviously exists.\n'));
