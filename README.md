# Command Reference — Pentest Command Builder & Attack-Path Map

A fast, **fully offline** command reference for offensive-security certifications — **CPTS, OSCP,
CWES, CDSA, and CRTP**. 900+ curated command cards with a live command builder, an interactive
attack-path map, a study/flashcard mode, and coverage dashboards. No install, no internet, no
accounts, no telemetry — it's a single folder of HTML/JS you open in any browser.

🌐 **Live site:** _coming soon_ — until then, open `index.html` locally.

---

## What it is

Every card is a real, exam-relevant command with its **placeholders turned into fields** — set your
target once (IP, user, domain, LHOST…) and every command fills in with your values, ready to copy.
Cards carry OpSec/noise levels, MITRE ATT&CK tags, defense/detection notes, and **attack-chain links**
so you can see what leads to a technique and where it goes next.

## Features

- **Command Builder** — pick a card, fill parameters once, copy a ready-to-run command. Multi-step
  chains fill too, with *Copy all* and *Copy as script* (bash/PowerShell).
- **Attack-Path Map** — an interactive graph of the recommended chains around any command
  (prerequisites → this → next/escalation), with a "path to Domain Admin"–style finder.
- **Study mode** — flashcards + quizzes for exam prep, with a **Weak-areas** set (spaced repetition)
  that resurfaces what you keep missing.
- **Coverage dashboards** — MITRE ATT&CK, per-certification, per-tool, and source-coverage %.
- **Search & filters** — relevance-ranked, typo-tolerant, `field:value` filters (`tool:hydra`,
  `opsec:loud`, `mitre:T1003`…), a 3-level category tree, favorites, collections, and personal notes.
- **Exam Mode** — a separate battle-station page: methodology playbook, host tracker, findings log,
  and one-click Markdown report export.
- **Export & print** — Markdown cheatsheets, runnable scripts, and a clean print stylesheet (Ctrl+P).
- **Offline & private** — self-contained, works on an exam/lab VPN; everything you personalize is
  saved locally in your browser.

## How to use

Download or clone the repo and open **`index.html`** in any modern browser — no install, no server,
works offline. (Or visit the hosted site once it's live.) Then:

### 1. Set your target once — the TARGET bar

The bar under the top navigation holds your **engagement variables**: IP, user, password, domain,
DC, LHOST/LPORT, and more. Fill them once and **every command auto-fills** with your values. It's
**alias-aware** — a command written with `<target>` or `<host>` still fills from your single **IP**
field. Click **Show all variables** for the full set.
Use the **≡ menu** to save the current values as a named **engagement** and switch between targets
(e.g. one per box), or export/import them to move a setup between machines.

### 2. Find a command

- **Search** (`Ctrl+K`) — relevance-ranked, match-highlighted, typo-tolerant. Narrow with
  `field:value`: `tool:hydra`, `opsec:loud`, `platform:windows`, `cat:enumeration`,
  `sub:kerberoasting`, `type:payload`, `mitre:T1003`, `tag:pivoting`, `access:credentials` —
  combine freely (`tool:crackmapexec opsec:loud spray`). The **?** by the box lists these.
- **Category tree** (left) — Category → Group → Subcategory, with counts on every node.
- **Filters, Favorites ★, Recently used, Collections** — in the sidebar / top toggles.

### 3. Build & copy

Click a card and the **builder** (right panel) shows the command filled with your target values.

- Fill any command-specific fields; **Unfilled** flags anything you still need to set; **Copy** grabs it.
- **Variations** are alternate ways to run it (tabs across the top of the builder).
- **Attack Chain** shows ordered steps with **Copy all** and **Script** (copy the whole sequence as a
  runnable bash/PowerShell script, target filled in).
- **Examples** are concrete captioned samples; **References** link the tool's docs + the course module.
- The **OpSec badge** (silent → loud) tells you how noisy it is; **MITRE** chips link to ATT&CK.

### 4. See the attack path — Map

The top-bar **Map** opens an interactive graph around the selected command: **what leads here**
(left) → **this** → **next / escalation** (right), colored by relationship. Click a node to
re-center, zoom with **− / ⤢ / +**, or use **Path to:** to trace the shortest chain from here to a
goal (e.g. Golden Ticket). **Export path** saves the whole path as a Markdown cheatsheet.

### 5. Study for your exam — Study

The top-bar **Study** gives **flashcards** (see the name + description, recall the command, reveal &
self-grade *Got it / Again*) and a **quiz** ("what's next after X?", "which command does X?"). Scope
to **All / Favorites / a cert**. Cards you miss are remembered as **Weak areas** and resurfaced
across sessions (spaced repetition) — so you drill exactly what you keep getting wrong.

### 6. Track coverage — Coverage

The top-bar **Coverage** has four tabs: **MITRE ATT&CK** technique counts, **By Certification**
(cards + defense/chain %), **Source coverage** (per-module tool-coverage %), and **Tools**. Click any
cell to filter the library to it.

### 7. Export & print

**Export** (top bar) turns the current filtered view into a **Markdown cheatsheet**. The **Script**
button (Attack Chain) copies steps as a runnable script. **`Ctrl+P`** prints a clean black-on-white
sheet (chrome stripped, reference URLs spelled out) for paper study.

### 8. Exam Mode

The **Exam Mode** button opens a separate battle-station page: engagement variables, a methodology
playbook, host tracker, findings log, and one-click **Markdown report** export. Push a command into
its findings log with the **Findings** button in any card.

### 9. Make it yours & back up

**Favorites ★**, **Collections** (your own named sets), and per-card **Notes ✎** all save locally in
your browser. From the **≡ menu → Back up ALL my data** you can export favorites, notes, engagements,
collections, and study progress to one JSON file, and **Restore** it later. Nothing ever leaves your
machine — clearing browser data wipes it, so back up.

---

## Add your own commands

The library is plain **JSON cards** (one file per command) plus a few Node scripts, built to be
extended. Two ways:

### Option A — Do it yourself with an AI coding agent

1. Open the project in an agent (Claude Code, Cursor, Copilot Chat, …).
2. Paste the ready prompt from **[`ADD-COMMANDS-PROMPT.md`](ADD-COMMANDS-PROMPT.md)** and drop your
   commands / notes at the bottom of it. (For a whole course module, use
   **[`NEW-SESSION-PROMPT.md`](NEW-SESSION-PROMPT.md)** instead — it has the full module protocol.)
3. The agent writes cards under `commands/**` following the schema.
4. Verify:
   ```
   npm run check      # build + schema validation + render sweep + coverage → "ALL GATES PASS"
   ```
5. Commit, and (if you're hosting it) redeploy.

**A card is just JSON** — target values become `<placeholders>` that auto-fill in the builder:

```json
{
  "id": "smb-share-enum",
  "name": "SMB - List Shares (null session)",
  "command": "smbclient -N -L //<ip>",
  "description": "List SMB shares over a null session — no credentials required.",
  "platform": "linux",
  "type": "command",
  "category": "Enumeration",
  "subcategory": "SMB",
  "certifications": ["CPTS"],
  "source": "CPTS Module 04: Footprinting",
  "opsec": "quiet",
  "tools": ["smbclient"],
  "tags": ["smb", "enumeration"],
  "mitre": ["T1135"],
  "references": [ { "title": "smbclient man page", "url": "https://www.samba.org/samba/docs/current/man-html/smbclient.1.html" } ],
  "recommended": [ { "id": "smb-mount", "rel": "next", "note": "mount a readable share" } ]
}
```

Rules the agent follows (and you should too): use **lowercase canonical placeholders** from
`js/vars.js` (`<ip>`, `<user>`, `<domain>`, `<lhost>`…) so they auto-fill; keep literal values in
`examples`, not `command`; never duplicate an `id`; and if a command isn't card-worthy on its own,
add it as a **variation / example / note** on the closest existing card rather than dropping it.
Full contract: **[`SCHEMA.md`](SCHEMA.md)**; workflow + QA: **[`AUTHORING.md`](AUTHORING.md)**.

### Option B — Have me deploy it for you

Prefer to hand it off? Send me (see **Contact**):

- **The source material** — your command notes / cheat-sheet / course export for the cert or module
  (Markdown, PDF, or plain text; the more command-rich, the better).
- **Which certification / course and modules** it's for.
- **Any conventions** you want (placeholder names, OpSec levels, house style) — optional.

I'll turn it into proper cards, run the QA gates, and deploy. Turnaround depends on volume.

## Contact

Bug reports, new-command requests, cert suggestions, and "deploy it for me" enquiries:

- **LinkedIn:** https://www.linkedin.com/in/FarouqHassan02
- **Email:** 12farouq12@gmail.com
- **GitHub issues:** open one on this repo

---

## Hosting & custom domain

It's a **static site** (one folder, no backend), so hosting is free and simple:

- **GitHub Pages** — enable Pages on the repo (Settings → Pages → deploy from `main`); it serves at
  `https://farouq7assan0o.github.io/command-reference/`.
- **Custom domain** — buy any domain, add a `CNAME` file with your domain to the repo, and point the
  domain's DNS (a `CNAME` record) at the Pages address. Works with any registrar/host (Cloudflare
  Pages, Netlify, and Vercel work the same way and give free HTTPS).

## License & disclaimer

MIT. For **authorized** security testing and education only — you are responsible for how you use it.
