# Command Reference - CPTS and more

> **NEW SESSION / AI AGENT: Read this entire section before touching anything.**
> Then read `PROGRESS.md` (mandatory process + module checklist) and `AUTHORING.md` (card workflow).
> Do not start work until you understand the vision below.

---

## Vision

This is being built as the **most comprehensive offensive and defensive security reference available** - for exams, active engagements, study, and detection engineering. It is not just a command cheat sheet.

**It is going online.** It will be publicly accessible, not just a local tool. Every card must be accurate, thorough, and useful to strangers - not just a personal scratchpad.

**Who it serves:**

- **Red team / pentesters** - copy-ready commands with live variable substitution, attack chains showing what to run before and after, full flag coverage from HTB/OSCP/CWES/CDSA modules, lab-tested variations from skills assessments.
- **Blue team / defenders** - every card's Defend tab shows detection (Event IDs, SIEM queries, Sigma patterns, log sources), artifacts left behind (forensic evidence, IOCs), prevention (patches, GPO settings, MITRE mitigations), and evasion techniques attackers use to bypass those defenses.
- **Students / exam takers** - the tool replaces going back to module notes. Every technique from every module is captured: commands, variations, attack chains, full notes, misconfigurations, root cause, impact. During an OSCP or CPTS exam with no internet, open `index.html` and everything is there.
- **Purple team** - every card shows both sides: what the attacker runs AND what it looks like to the defender (artifacts, detection, prevention). The card links forward to the next attack step and backward to what had to be true first.

**The standard for every card:**

A card is not done until a defender can read it and know exactly what to look for, and a student can read it and understand the whole technique without going back to the notes. That means:

1. **Attack side** - canonical command, all meaningful variations, captioned examples from labs, full attack chain (recommended links to next/prereq cards), notes with caveats and cleanup.
2. **Defense side** (`defense` object) - `prerequisites` (what must be true for the attack to work), `why_it_works` (the root cause / misconfiguration), `misconfiguration` (the specific bad setting), `vulnerable_config` (insecure code/config snippet), `secure_config` (corrected version), `impact` (what the attacker gains), `detection` (Event IDs, log sources, SIEM queries), `artifacts` (what it leaves behind), `prevention` (mitigations, MITRE M-IDs, hardening steps), `evasion` (how attackers bypass the detections).
3. **MITRE ATT&CK** - every command/payload/attack-chain card carries the most specific ATT&CK sub-technique ID(s) in the `mitre` field. These link to attack.mitre.org and are used to enrich the defense content. When adding a card or checking an existing one, look up the MITRE technique page and pull detection guidance, data sources, and mitigation IDs into the `defense` object.
4. **References** - every card has: (1) the tool's official repo/docs, (2) the HTB Academy module link, (3) for exploits the CVE/vendor advisory, (4) the MITRE ATT&CK technique page where a TTP applies.

**Sources for defense content (in priority order):**
1. HTB module text - cert-specific framing, comes first
2. MITRE ATT&CK technique + mitigation pages (attack.mitre.org/techniques/TXXX, /mitigations/MXXX)
3. Microsoft official docs (Event IDs, GPO, hardening guidance)
4. SANS / CIS benchmarks

Never invent defense content. Only populate from verified sources. Missing > invented.

---

## Protocol: Processing a Cert Chapter — MANDATORY AGGRESSIVE STANDARD

> This protocol applies to every chapter from every cert (OSCP, CPTS, CWES, CDSA, CRTP, HTB, …).
> It exists because lazy "covered" calls lead to gaps that only surface on an exam. Follow it exactly.
> Shortcuts here cost tokens later when you re-audit.

### Step 1 — Extract every code block

Parse the source file (HTML or Markdown). Do not skim. Do not read the chapter and paraphrase.
Extract every `<code>` / `<pre>` block as a numbered list. For HTML chapters, use this exact approach:

```python
from html.parser import HTMLParser

class CodeExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_code = False; self.blocks = []; self.current = []; self.depth = 0
    def handle_starttag(self, tag, attrs):
        if tag in ('code','pre'): self.in_code = True; self.depth += 1
    def handle_endtag(self, tag):
        if tag in ('code','pre'):
            self.depth -= 1
            if self.depth <= 0:
                self.depth = 0
                if self.current:
                    b = ''.join(self.current).strip()
                    if b: self.blocks.append(b)
                self.current = []; self.in_code = False
    def handle_data(self, data):
        if self.in_code: self.current.append(data)

with open("<chapter>.html", encoding='utf-8', errors='ignore') as f:
    p = CodeExtractor(); p.feed(f.read())
for i, b in enumerate(p.blocks):
    print(f"=== BLOCK {i+1} ==="); print(b[:400]); print()
```

For Markdown chapters, extract every fenced code block and indented block similarly.

### Step 2 — For EACH block, make an explicit coverage decision

For every block, record: **Block N → technique → verdict → reason**.

**Verdicts:**
- `COVERED` — an existing card has the **exact command pattern, tool, flags, and payload structure**. Not just the concept. Not just a similar tool.
- `PARTIAL` — an existing card covers the concept but uses the wrong specific tool, wrong flags, wrong payload variant, or is missing this stage of the attack chain. A partial is a gap.
- `MISSING` — no card exists for this technique at all.
- `SKIP` — narrative text, output sample, or explanation with no command. Must justify the skip.

**What NEVER counts as COVERED:**
- Card has the technique but a different specific tool (e.g. card uses WMI exec, chapter teaches Wscript.Shell — PARTIAL, not covered)
- Card has the main attack but not the delivery mechanism (e.g. WebDAV attack covered but not the smbclient delivery — MISSING)
- Card has the payload but not the chapter-canonical payload variant (e.g. generic DownloadString covered but not the powercat two-stage pattern taught in the chapter — PARTIAL)
- Card has the enumeration but not the specific flag combination shown in the chapter
- Card has step 2 of a 3-step chain but not step 1 or step 3

**What counts as SKIP (with justification):**
- Command-line output / terminal response (not a command you type)
- XML/config fragments that are already captured in the main card's command field
- Structural VBA boilerplate (empty Sub) shown as a conceptual starting point only
- Social engineering text / phishing email copy (not a technical command)
- Diagram labels or table data

### Step 3 — For every PARTIAL or MISSING, decide: patch or new card

- **Patch an existing card** when the gap is an additional example, variation, or delivery step for a technique the card already covers. Add it as a new entry in `examples` or `variations`.
- **Create a new card** when the technique is genuinely absent from the library, or when the specific command is different enough that mixing it into an existing card would create confusion (different tool, different ATT&CK technique, different platform, different attack stage).

### Step 4 — Check attack chains explicitly

After checking individual blocks, ask: does the chapter show a multi-step attack chain? If yes, verify that:
1. Every step in the chain is captured — not just the headline technique
2. The setup/prerequisite step is in `recommended` as a `prereq` link
3. The delivery/staging step is an example on the main card or a separate card
4. The catch/receive step (nc listener, SMB listener, etc.) is noted

### Step 5 — References: mandatory composition for every card

Every card — new or patched — must have `references` that satisfy ALL of these:

**A. Tool/technique official source (always required)**
- The tool's official GitHub repo, man page, or vendor doc (e.g. `https://github.com/DominicBreuker/pspy`)
- For exploit techniques: the CVE advisory or vulnerability write-up
- For GTFOBins techniques: `https://gtfobins.github.io/gtfobins/<tool>/`
- For ATT&CK-tagged techniques: the MITRE technique page `https://attack.mitre.org/techniques/TXXX/`

**B. Cert course page (required per cert in the `certifications` array)**
- OSCP / PEN-200: `https://www.offsec.com/courses/pen-200/`
- CPTS: `https://academy.hackthebox.com/module/details/<module_id>`
- CWES: the relevant HTB Academy module link
- CDSA: the relevant HTB Academy module link
- CRTP: the Altered Security course page

**Rule: if a card has `"OSCP"` in `certifications`, it must have the OffSec URL in `references`.**
**Rule: if a card has `"CPTS"` in `certifications`, it must have the HTB Academy module URL in `references`.**

Never add a reference you can't verify. Missing > invented.

### Step 6 — Recommended: every card needs a chain anchor

Every card must have at least ONE `recommended` entry with `rel` of `"next"` or `"prereq"`. Cards with only `"alternative"` or `"escalation"` are incomplete — the attacker has no path to follow.

- `prereq` — what must happen or be confirmed first (recon, enumeration, condition check)
- `next` — the natural follow-on technique after this one succeeds
- `alternative` — a different technique for the same goal (different tool, different bypass)
- `escalation` — what this enables (e.g. local shell → domain admin)
- `cleanup` — how to remove artifacts

**Minimum chain requirement:** every card must have at least one `prereq` OR one `next`.

If a technique is genuinely the first step (nothing comes before it), link `next` to where it leads.
If it's genuinely the last step (root shell, domain admin), link `prereq` to what enabled it and add `escalation` to what you do with the access.

### Step 7 — Multi-cert source tracking

When you process a chapter from cert B and find that an existing card (originally from cert A) covers the same technique:

1. Add cert B to the card's `certifications` array if not already there.
2. Add cert B's course page URL to `references` if not already there.
3. Add this to the card's `notes` field: `"Also covered in: OSCP PEN-200 Chapter 17"`
4. Do NOT change the `source` field — it records where the card was originally authored.
5. Do NOT create a duplicate card. One card, all certs listed.

When a technique is genuinely different in the two certs (different tool, different payload, different scope), create a new card and cross-link them via `recommended`.

### Step 8 — Write the PROGRESS.md log entry with this format

```
BLOCK-BY-BLOCK GAP ANALYSIS (N code blocks):
  Block 1:  <command snippet> -> <verdict>: <card-id> [or reason for SKIP]
  Block 2:  <command snippet> -> PARTIAL: <card-id> uses X not Y
  Block 5:  <command snippet> -> MISSING: no card covers this
  ...

PATCHES:
  1. <card-file-path>
     GAP 1: <exact description of what was missing and why it matters>
     FIX: <what was added>
  ...

NEW CARDS:
  1. <card-file-path> — <one-line description>

RESULT: X cards patched, Y net-new cards. Build PASS N cards.
```

The log must be specific enough that a future session can reconstruct what was checked and why.

---

> **Adding or redoing a module? START WITH [`AUTHORING.md`](AUTHORING.md).** It's the full
> workflow + the QA checklist, and it points to `SCHEMA.md` (the card contract) and `js/vars.js`
> (the placeholder vocabulary). The rule is: author to the schema, then run `node validate.js`
> until it PASSES. Don't guess whether a module is done - the validator tells you.

---

## How to start a new session (AI agent or human)

**Read in this exact order. Do not start any work until all four are read.**

### 1. Read PROGRESS.md

Location: `command-reference/PROGRESS.md`

What to extract from it:
- The **current card count** and build status (last line of the file)
- The **module/chapter checklist** — what is marked done vs pending
- The **known backlog** — outstanding debt that future sessions should chip away at:
  - ~631 multi-cert cards have CPTS as primary source but are also tagged OSCP — they are missing the OffSec course URL in `references` and a note in `notes` saying which OSCP chapter also covers them. Fix these opportunistically when touching those cards.
  - ~276 cards have `recommended` entries with only `alternative`/`escalation` rels — no `next` or `prereq`. Every new/patched card must have at least one `next` or `prereq`. Fix backlog cards opportunistically.
- The **last session's work** — what was just done, so you don't redo it

### 2. Read AUTHORING.md

Location: `command-reference/AUTHORING.md`

This is the card-writing workflow and the pre-commit checklist. Read the checklist section carefully — it covers:
- Required fields and their valid values
- References rule (tool docs + cert course URL mandatory)
- Recommended chain rule (must have next/prereq, not only alternatives)
- Multi-cert tracking rule (certifications[], references[], notes update)
- How to run `node build-commands.js` and `node validate.js`

### 3. Read SCHEMA.md

Location: `command-reference/SCHEMA.md`

The frozen card contract. Every field, every valid value, every rule for `defense` sub-fields, placeholder vocabulary, and type taxonomy. Do not guess field names — check the schema.

### 4. Know the file layout

```
command-reference/              ← project root, run all node commands from here
  commands/
    cpts/<phase>/<technique>/   ← CPTS-primary cards
    oscp/<technique>/           ← OSCP-primary cards (OSCP-unique techniques only)
    cwes/                       ← CWES-primary cards
    cdsa/                       ← CDSA-primary cards
    crtp/                       ← CRTP-primary cards
    _shared/                    ← cross-cert reference cards
  js/vars.js                    ← canonical placeholder vocabulary (use these tokens)
  js/commands.js                ← GENERATED — never hand-edit
  build-commands.js             ← regenerates js/commands.js
  validate.js                   ← QA gate — must report PASS before any session ends
  coverage.js --module NN       ← diffs source notes vs cards (what was missed)
  suggest-chains.js --module NN ← recommends recommended[] candidates
  PROGRESS.md                   ← living log + module checklist
  AUTHORING.md                  ← workflow + pre-commit checklist (read this)
  SCHEMA.md                     ← card contract (frozen)
  README.md                     ← this file

Source material (siblings of command-reference/):
  CPTS notes/<NN Module>/       ← Commands.md + EXPLANATION NOTES.md per module
  CPTS FULL/<NN>.md             ← raw HTB content per module
  OffSec - PEN-200 Book 2024.11 hide01.ir/  ← OSCP chapter HTML files
```

### 5. Ask the user what to work on — then follow the Protocol

Do NOT pick a module yourself. Do NOT process multiple chapters in one session.

Once the user names a chapter or module:

**a) Extract every code block** using the Python extractor in the "Protocol: Processing a Cert Chapter" section of this file. Run it. Get numbered blocks.

**b) For each block, assign a verdict:** `COVERED` / `PARTIAL` / `MISSING` / `SKIP`

Rules that can never be broken:
- "Concept covered" ≠ `COVERED`. The exact tool, flags, and payload pattern must match.
- A missing delivery step is `MISSING` even if the main attack is covered.
- A different specific tool for the same technique is `PARTIAL` — which is a gap.
- Only output (terminal responses), structural boilerplate, and social-engineering copy may be `SKIP`.

**c) Find existing cards** before creating new ones:
```bash
find commands/ -name "*.json" | xargs grep -li "<keyword>" 2>/dev/null
```

**d) Patch existing cards** when the gap is an additional example/variation on something already covered.
**Create new cards** when the technique is genuinely absent.

**e) For every card touched (new or patched), verify the checklist:**
- `references[]`: tool docs + cert course page (OffSec URL if OSCP in certifications)
- `recommended[]`: at least one `prereq` or `next` — not only alternatives
- If multi-cert: certifications[], references[], and notes all updated
- `opsec`, `mitre`, `tools`, `source`, `certifications`, `primary_cert` all set

**f) Build and validate:**
```bash
cd command-reference
node build-commands.js   # regenerates js/commands.js + auto-runs validate
node validate.js         # must report PASS — 0 hard errors, 0 command-lint
```

**g) Update PROGRESS.md** using the mandatory block-by-block log format defined in the "Protocol" section of this file.

## Run it

Open `index.html` in a browser. Nothing to install. **Fully offline** - no CDN, external fonts,
or scripts, so it works on an exam/lab VPN with no internet. Icons are self-hosted inline SVG
(`css/icons.css`). The only external URLs are the in-card reference links, which open on click.

## What it does

- **Command Builder** - pick a card, fill parameters, get a copy-ready command with your values
  substituted live. Multi-step attack chains are substituted too, with a "Copy all" button; an
  "Unfilled" hint shows which variables you still need to set.
- **Target Context bar** - one compact line of engagement variables (IP, user, password, domain,
  DC, LHOST/LPORT, ...). Set once, they fill every command. "Show all variables" reveals the rest.
  Alias-aware: a card written with `<target>` or `<host>` still fills from the single `IP` field.
- **Named engagements** - save the current variable set under a name and switch between targets
  (the `≡` menu by the context bar: Save / Save as / Rename / Delete). Export all engagements to
  JSON and import them on another machine, so you carry a lab/exam setup with you.
- **My Notes** - add your own annotation to any command (gotchas, lab tweaks, what worked). Saved
  locally, shown in the builder, findable in search, and flagged with a ✎ mark on the card.
- **Backup / Restore** - the `≡` menu can export ALL your personal data (favorites, notes,
  engagements, context) to one JSON file and restore it - so your work survives a machine wipe.
- **3-level category tree** - Category -> Group -> Subcategory, so a 38-subcategory phase like
  Enumeration is navigable. Click a group to see everything in it; counts on every node.
- **Search** (Ctrl+K) - relevance-ranked across names, commands, tags, tools, and MITRE IDs, with
  the matched term highlighted and light typo tolerance (`krbroast` finds Kerberoast). Narrow with
  `field:value` filters - `tool:hydra`, `opsec:loud`, `platform:windows`, `cat:enumeration`,
  `sub:kerberoasting`, `type:payload`, `mitre:T1003`, `tag:pivoting`, `access:credentials` -
  combinable with each other and free text (`tool:crackmapexec opsec:loud spray`). Click the `?`
  by the search box for the in-app cheatsheet.
- **Filters** - certification, type, platform, OpSec/noise level, access level, protocol, tool,
  plus favorites (sidebar dropdowns, applied on top of search).
- **Keyboard nav** - Up/Down through results, Enter to open, Esc to close the mobile drawer.
- **Recently Used** - a sidebar toggle showing the last commands you opened, most-recent first, so
  the handful you're hammering on a box are one click away (alongside Favorites).
- **Collections** - build your own named sets ("my OSCP row", "AD attacks"). The bookmark button in
  a card's builder adds/removes it and creates collections; the sidebar dropdown filters to one.
  Cards in a collection show a bookmark mark.
- **OpSec + MITRE** - each card can carry a noise level (silent/quiet/moderate/loud, shown as a
  colored badge and filterable) and ATT&CK technique chips that link to attack.mitre.org.
- **Attack-Path Map** (top bar "Map") - an interactive graph of the recommended-chains around a
  card: what leads here (left) -> this card -> next/escalation (right), edges colored by
  relationship, opsec pip per node, click a node to re-center, zoom controls, plus a "Path to:"
  finder that shortest-path-searches the chain from the current card to a goal. Dependency-free
  inline SVG, offline. Also has an "Export path" button (path -> Markdown cheatsheet).
- **Study Mode** (top bar "Study") - flashcards (recall the command from its name/description, then
  reveal + self-grade Got it/Again) and quizzes (chain "what's next after X?" and recall "which
  command does X?", scored), scoped to All / Favorites / a specific cert. Built for exam prep.
- **Coverage** (top bar "Coverage") - MITRE ATT&CK technique counts, per-certification
  card/defense/chain coverage, and a tool index - each cell clickable to filter the library.
- **Export as script** - the Attack Chain box has a "Script" button that copies the steps as a
  runnable bash/PowerShell script (platform-aware) with your target values filled in; the top-bar
  "Export" turns the current filtered list into a Markdown cheatsheet.
- **Exam Mode** (`exam.html`) - a separate "battle station" with engagement variables, a
  methodology playbook, host tracker, findings log, and one-button markdown report export. Shares
  the same variable vocabulary (`js/vars.js`) as the main app.
- **Send to Findings** - a card's builder has a "Findings" button that pushes the command (with
  your filled values) straight into the Exam Mode findings log, so what you run flows into the
  report you hand in.
- **Mobile** - the sidebar collapses to a slide-in drawer; layout stacks and stays usable.
- **Print** - a print stylesheet strips the chrome and prints the current cards in black-on-white
  with reference URLs spelled out, so you can make a paper cheatsheet (Ctrl+P) for offline study.

## Repository layout

```
index.html            main app (Command Manager + Builder)
exam.html             Exam Mode battle station
build-commands.js     walks commands/**.json -> writes js/commands.js (then auto-runs validate.js)
validate.js           schema + lint + completeness + placeholder + opsec + reference validator (QA gate)
healthcheck.js        whole-library render/behaviour sweep - botched placeholders, empty commands,
                      duplicate variation labels; `--render` headless-renders every card + tab (jsdom)
coverage.js           diffs a module's source notes vs cards; `--tools` = tool-level coverage %
                      (the trustworthy completeness signal - see AUTHORING.md "Coverage & completeness")
coverage-report.js    writes js/coverage-data.js - the per-module tool-coverage snapshot the app's
                      Coverage > "Source coverage" tab displays (re-run after adding/redoing modules)
suggest-chains.js     proposes "recommended next" candidates for cards that have none
chain-health.js       flags attack cards that dead-end (no next step) or have no predecessor, so the
                      Attack-Path Map / Study chains can be enriched over time (aid, not a gate)
commands/             one JSON file per command card (source of truth)
  cpts/<phase>/<technique>/*.json
  _shared/            cross-module cheatsheets/resources
js/
  commands.js         GENERATED data file (do not edit by hand)
  coverage-data.js    GENERATED tool-coverage snapshot (by coverage-report.js) for the Coverage tab
  app.js              UI: tree, filters, list (windowed), builder, context bar, keyboard nav, and the
                      Attack-Path Map / Study Mode / Coverage overlays + Export helpers
  vars.js             canonical engagement-variable registry (placeholder vocabulary + aliases)
  groups.js           Category -> Group mapping for the 3-level tree (no card edits needed)
  exam.js             Exam Mode logic
css/styles.css        styling (incl. responsive/mobile + Map/Study/Coverage overlays)
css/icons.css         self-hosted inline-SVG icon set (replaces the FontAwesome CDN - offline).
                      To add an icon: add `.fa-NAME { --i: url("data:image/svg+xml,<svg ...>") }`
SCHEMA.md             FROZEN card contract - the data model
AUTHORING.md          how to add/redo a module + QA checklist + Maintenance & Coverage sections
PROGRESS.md           living build log + module checklist + running total
coverage-decisions.md the "why was this skipped / where did it go" ledger from the coverage audit
NEW-SESSION-PROMPT.md paste-at-start orientation block for a new chat
```

## Add or edit commands

Read **`AUTHORING.md`** first - it's the full workflow and QA checklist. In short:

1. Add/edit `.json` cards under `commands/cpts/<phase>/<technique>/` per **`SCHEMA.md`**, using
   canonical placeholders from **`js/vars.js`**.
2. Build: `node build-commands.js` (regenerates `js/commands.js`).
3. Validate: `node validate.js` - must report **0 hard errors**; review the completeness table
   and placeholder audit.
4. Update `PROGRESS.md`.

## Validate (the QA gate)

```sh
node validate.js                 # full report: hard errors + completeness + placeholder audit + coverage
node validate.js --module 13     # scope to one module
node validate.js --errors-only   # just the blocking issues
node validate.js --json          # machine-readable (CI / tooling)
node validate.js --strict        # also fail if any module completeness < 90%
```

`node build-commands.js` auto-runs the validator after building (set `SKIP_VALIDATE=1` to skip).

Coverage - did the cards capture everything in a module's source notes?

```sh
node coverage.js --module 03      # lists source commands with no matching card (review list)
```

## Taxonomy

Grouping is decoupled from the cert module so a service (SMB, DNS, LDAP...) stays in one place no
matter which module it came from:

- `category` = engagement phase (Enumeration, Exploitation, Web Exploitation, Password Attacks,
  Privilege Escalation, Lateral Movement, Pivoting & Tunneling, Post-Exploitation, ...).
- `subcategory` = service/technique (SMB, DNS, Kerberoasting, SQLMap, ...). For Privilege
  Escalation, prefixed by OS ("Windows - ...", "Linux - ...").
- The **group** layer (Category -> Group -> Subcategory) is derived in `js/groups.js` from
  (category, subcategory) - it needs no changes to card files.
- `certifications` and `source` (module) stay as separate filter/metadata.

## Status

See `PROGRESS.md` for the authoritative module checklist and running total. As of the last build:
**852 cards** (2026-08-04): CPTS M01-M26 (651), OSCP Ch6-26 (53 primary, 697 tagged), CWES M01-M20 (35 primary, 211 tagged), CDSA M01-M15 (75 primary), CRTP (37 primary, 100 tagged). Build: PASS, 0 hard errors. M27-M28 pending.
