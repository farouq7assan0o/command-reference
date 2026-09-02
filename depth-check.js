#!/usr/bin/env node
/*
 * depth-check.js - find SHALLOW attack cards, so the DEPTH RULE gets enforced over time.
 *
 * The tool-level coverage signal (coverage.js --tools / coverage-all.js) can only see a MISSING
 * tool. It is blind to a technique that IS carded but was carded shallowly - one headline command
 * with none of the alternate forms the source showed (different OS, different auth, different tool
 * for the same goal, the delivery step, ...). That is exactly how the CRTP PowerView enumeration
 * cards drifted: the tool was "present," but 20+ real variations were missing.
 *
 * This is an AID, not a hard gate (like chain-health.js): some command cards are legitimately a
 * single atomic action with no variants. It flags the ones that are USUALLY too thin so they can
 * be re-checked against the source.
 *
 *   node depth-check.js            # summary + the shallow-card list (worst first)
 *   node depth-check.js --all      # also list borderline cards (exactly 1 variation/step)
 *   node depth-check.js --json     # machine-readable
 *
 * A command/payload/attack-chain card is SHALLOW when it has:
 *   - 0 variations AND 0 steps AND <= 1 example
 * attack-chain cards additionally EXPECT steps[] (per the protocol) - a chain with no steps is flagged.
 * reference / cheatsheet / script / resource cards are exempt (they are not technique cards).
 */
const fs = require('fs'), path = require('path');
require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, 'js', 'commands.js'), 'utf8') + ';globalThis.__D=COMMAND_DATA;');
const cards = globalThis.__D.commands.filter(c => c && c.id);

const ALL = process.argv.includes('--all');
const JSON_OUT = process.argv.includes('--json');
const TECH_TYPES = new Set(['command', 'payload', 'attack-chain']);
const c = (n, s) => process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s;

const nv = x => (x.variations || []).length;
const ns = x => (x.steps || []).length;
const ne = x => (x.examples || []).length;

const shallow = [], borderline = [], chainNoSteps = [];
for (const x of cards) {
    if (!TECH_TYPES.has(x.type || 'command')) continue;
    const depth = nv(x) + ns(x);
    if ((x.type || 'command') === 'attack-chain' && ns(x) === 0) chainNoSteps.push(x);
    if (depth === 0 && ne(x) <= 1) shallow.push(x);
    else if (depth === 1) borderline.push(x);
}

if (JSON_OUT) {
    console.log(JSON.stringify({
        shallow: shallow.map(x => x.id),
        chainNoSteps: chainNoSteps.map(x => x.id),
        borderline: borderline.map(x => x.id)
    }, null, 2));
    process.exit(0);
}

const techCount = cards.filter(x => TECH_TYPES.has(x.type || 'command')).length;
console.log('\n  Command Reference - Depth Check');
console.log('  ' + techCount + ' technique cards (command/payload/attack-chain)');
console.log('-'.repeat(60));
console.log('  ' + c(shallow.length ? 33 : 32, 'SHALLOW (0 variations + 0 steps + <=1 example): ' + shallow.length));
console.log('  ' + c(chainNoSteps.length ? 33 : 32, 'attack-chain with NO steps[]: ' + chainNoSteps.length));
console.log('  borderline (exactly 1 variation/step): ' + borderline.length);
console.log('-'.repeat(60));

const line = x => '    - ' + x.id.padEnd(34) + ' [' + (x.type || 'command') + '/' + (x.category || '?') + ']  v' + nv(x) + ' s' + ns(x) + ' e' + ne(x);
if (shallow.length) {
    console.log('\n  SHALLOW cards (re-check against the source - the DEPTH RULE wants alternate forms):');
    shallow.sort((a, b) => (a.category || '').localeCompare(b.category || '')).forEach(x => console.log(line(x)));
}
if (chainNoSteps.length) {
    console.log('\n  attack-chain cards missing steps[] (every chain should capture the sequence):');
    chainNoSteps.forEach(x => console.log(line(x)));
}
if (ALL && borderline.length) {
    console.log('\n  BORDERLINE (only 1 variation/step - confirm the source had no more):');
    borderline.sort((a, b) => (a.category || '').localeCompare(b.category || '')).forEach(x => console.log(line(x)));
}
console.log('\n  Aid, not a gate. A genuinely atomic command can stay shallow - just make it a conscious call.');
console.log('  Run `node depth-check.js --all` for borderline cards.\n');
