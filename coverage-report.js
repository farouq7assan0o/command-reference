#!/usr/bin/env node
/*
 * coverage-report.js - generate js/coverage-data.js, a per-module TOOL-COVERAGE snapshot the app
 * can display offline (the browser can't read the source notes at runtime, so we bake the numbers
 * in here, like build-commands.js bakes the cards into js/commands.js).
 *
 * Tool coverage = "of the distinct tools this module's source uses, how many appear in >=1 card?"
 * (substring-matched against the whole card corpus, so a tool used inside a pipeline still counts).
 * This is the trustworthy completeness signal - see AUTHORING.md "Coverage & completeness".
 *
 * Run:  node coverage-report.js       (re-run after adding/redoing modules)
 */
const fs = require('fs'), path = require('path');
require('vm').runInThisContext(fs.readFileSync(path.join(__dirname, 'js', 'commands.js'), 'utf8') + ';globalThis.__D=COMMAND_DATA;');
const cards = globalThis.__D.commands;

const KNOWN = new Set('sh bash shell console powershell ps ps1 pwsh cmd bat batch python python3 py ruby rb perl php sql go text txt json xml yaml yml http https ini diff c cs javascript js java jsp asp html css groovy rust req apacheconf conf config nginx apache properties toml dockerfile csv log yara kql spl shell-session powershell-session cmd-session console-session'.split(' '));
const SKIP = new Set('text txt json xml yaml yml http https ini diff html css javascript js java jsp asp c cs groovy rust req apacheconf conf config nginx apache properties toml dockerfile csv log shell-session powershell-session cmd-session console-session'.split(' '));
function extract(txt) {
    const out = []; const lines = txt.split(/\r?\n/); let inF = false, lang = '';
    for (const ln of lines) {
        const f = ln.match(/^```(\S*)(.*)$/);
        if (f) { const tok = (f[1] || '').toLowerCase(); if (!inF) { if (tok && !KNOWN.has(tok)) { const cmd = (f[1] + f[2]).trim(); if (cmd && !cmd.startsWith('#')) out.push(cmd); inF = true; lang = 'sh'; } else { inF = true; lang = tok; } } else inF = false; continue; }
        if (!inF || SKIP.has(lang)) continue; const t = ln.trim(); if (!t || t.startsWith('#') || t.startsWith('//')) continue; out.push(t);
    }
    return out;
}
const STOP = new Set(['sudo', 'then', 'do', 'done', 'fi', 'else', 'time']);
const toolOf = c => { let k = String(c).split(/\s*\|\s*/)[0].trim().split(/\s+/), i = 0; while (i < k.length && (STOP.has(k[i].toLowerCase()) || /=/.test(k[i]))) i++; return (k[i] || '').toLowerCase().replace(/^.*[\\/]/, ''); };
function isNoise(raw) { const t = String(raw).trim(); if (!t) return true; if (/^[A-Za-z_]\w*=\S*$/.test(t) || /^[A-Za-z_]\w*=(["']).*\1$/.test(t)) return true; if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(t)) return true; if (/^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+$/.test(t)) return true; if (/^\/[\w./@-]+$/.test(t)) return true; if (/^<[!/a-zA-Z]/.test(t)) return true; if (/^https?:\/\/\S+$/.test(t)) return true; if (/^\S+\s+(-h|--help|-\?)\s*$/.test(t)) return true; if (/^\d+\s/.test(t) && !/^\d+\.\d/.test(t)) return true; if (/^[|>]/.test(t)) return true; if (/^[A-Z]{2,}$/.test(t)) return true; return false; }
const SETUP = new Set('cd ls pwd mkdir rmdir rm cp mv touch chmod chown export source pip pip3 apt apt-get yum dnf gem go git make cmake tar unzip gunzip systemctl service cpan cargo npm python python3 sh bash nano vim vi cat grep cut awk sort uniq tr sed echo printf wc head tail less more clear which locate man file'.split(' '));

const cardStrs = [];
cards.forEach(c => { [c.command, ...(c.variations || []).map(v => v.command), ...(c.steps || []).map(s => s.command), ...(c.examples || []).map(e => typeof e === 'string' ? e : e && e.command)].forEach(s => { if (s) cardStrs.push(s); }); });
const corpus = cardStrs.join('\n').toLowerCase();
const cardToolSet = new Set(); cards.forEach(c => (c.tools || []).forEach(t => cardToolSet.add(String(t).toLowerCase())));
const carded = t => cardToolSet.has(t) || corpus.includes(t);

const notesDir = path.join(__dirname, '..', 'CPTS notes');
let mods = [];
try { mods = fs.readdirSync(notesDir).filter(d => /^\d/.test(d)).sort(); } catch (e) { console.error('cannot read', notesDir, '-', e.message); process.exit(2); }

const out = [];
for (const mod of mods) {
    const dir = path.join(notesDir, mod);
    const files = fs.readdirSync(dir).filter(f => /\.md$/i.test(f));
    const srcTools = new Set(); const seen = new Set();
    for (const fn of files) {
        for (const cmd of extract(fs.readFileSync(path.join(dir, fn), 'utf8'))) {
            const key = cmd.replace(/\s+/g, ' '); if (seen.has(key)) continue; seen.add(key);
            if (isNoise(cmd) || SETUP.has(toolOf(cmd))) continue;
            const t = toolOf(cmd);
            if (t && t.length >= 3 && /^[a-z][a-z0-9][a-z0-9._-]*$/.test(t)) srcTools.add(t);
        }
    }
    const uncarded = [...srcTools].filter(t => !carded(t)).sort();
    const total = srcTools.size, covd = total - uncarded.length;
    out.push({ mod: mod.slice(0, 2), name: mod.replace(/^\d+\s*/, ''), total, carded: covd, pct: total ? Math.round(covd / total * 100) : 100, uncarded });
}
const overall = out.reduce((a, m) => ({ t: a.t + m.total, c: a.c + m.carded }), { t: 0, c: 0 });
const payload = { generated: new Date().toISOString().slice(0, 10), cert: 'CPTS', overallPct: overall.t ? Math.round(overall.c / overall.t * 100) : 100, modules: out };
fs.writeFileSync(path.join(__dirname, 'js', 'coverage-data.js'), 'const COVERAGE_DATA = ' + JSON.stringify(payload, null, 2) + ';\n');
console.log('wrote js/coverage-data.js -', out.length, 'CPTS modules, overall tool coverage', payload.overallPct + '%');
