# New Session Prompt — command-reference card library

Lives in the project root: `D:\moving\Archive\Security\command-reference\NEW-SESSION-PROMPT.md`
(this is the pentest command-reference tool dir — NOT the CDSA/blue-team notes).

Paste the block below at the start of any new chat when working on this project.

---

## PASTE THIS:

```
We're working on a pentest command-reference library at:
D:\moving\Archive\Security\command-reference\

Before doing anything, read these files IN THIS ORDER:

1. D:\moving\Archive\Security\command-reference\PROGRESS.md
   → Get: current card count, what modules/chapters are done, audit status, last session's work.
     (Treat any backlog numbers in older entries as stale — measure live per INVARIANTS below.)

2. D:\moving\Archive\Security\command-reference\README.md
   → Get: vision, the full "Protocol: Processing a Cert Chapter" section (mandatory), and the
     "How to start a new session" section. Both are required reading — they contain the extraction
     code, verdict rules, references rules, and chain rules.

3. D:\moving\Archive\Security\command-reference\AUTHORING.md
   → Get: the pre-commit checklist. This is what you run through before every validate.

4. D:\moving\Archive\Security\command-reference\SCHEMA.md
   → Get: every field, valid value, and defense sub-field. Do not guess field names.

After reading all four, tell me: current card count, which modules/chapters are done, and what
is pending. Then wait for me to name the chapter or module. Do NOT recite backlog numbers from
memory — if I ask about backlogs, MEASURE them live (see INVARIANTS below) and report the real
count, not a figure from an old prompt or an old PROGRESS entry.

---

CURRENT STATE (as of 2026-08-26 — verify, don't trust blindly):

  • 905 cards, build PASS, 0 hard errors, healthcheck PASS.
  • THIS PROJECT HAS TWO SIDES:
      (A) CARD AUTHORING — the bulk of this doc (sources, protocol, invariants below).
      (B) THE WEB APP + TOOLING — index.html + js/app.js, and the maintenance scripts. If you're
          working on the app/features (not cards), read README.md "What it does" + "Repository
          layout" and AUTHORING.md's "Maintenance & health checks" and "Coverage & completeness"
          sections. Features already built: Command Builder, Attack-Path Map, Study Mode, Coverage
          dashboards, Export (script + path), Exam Mode. Don't rebuild these — extend them.
  • MAINTENANCE LOOP (run after ANY change, cards or code):
      npm run check                   # one command: build + validate + healthcheck --render + coverage
                                      # snapshot -> prints "ALL GATES PASS". Or run individually:
      node build-commands.js          # regenerate js/commands.js (auto-runs validate)
      node validate.js --errors-only  # schema gate — must say RESULT: PASS
      node healthcheck.js --render    # behaviour gate — 0 botched placeholders / dup labels / crashes
  • COVERAGE / COMPLETENESS: `node coverage.js --module NN --tools` is the trustworthy signal (~90-100%
    per module). Raw line-coverage over-reports (config/wordlists/output/lab-literals) — see
    coverage-decisions.md for the full "why skipped / where it went" ledger. The 2026-08 audit found
    the library already complete for real techniques; a few usable commands were added as
    variations/notes rather than new cards (that's the standard: card = new technique; variation/
    note = a usable command alongside a technique already carded).
  • All 28 CPTS modules audited: M01 is theory-only (SKIP, no commands); M02–M28 have
    full-protocol deep-audit entries in PROGRESS.md. M27 (Documentation & Reporting) is NOT
    pure theory — it has tmux-logging + engagement-folder cards. M28 is the capstone.
  • The two historically-cited backlogs are CLEARED (verified 0): every OSCP-tagged card has
    the OffSec URL; every command/payload/attack-chain card has a recommended chain with a
    next/prereq. Do NOT go hunting for these as if they were open — confirm with the measures
    below and move on if they read 0.

---

INVARIANTS — these must stay at ZERO. Measure live before claiming any are "open":

  1. OSCP-URL: cards with "OSCP" in certifications[] but no offsec.com URL in references[].
       python3 - <<'PY'
       import json,glob
       print(sum('OSCP' in json.load(open(f)).get('certifications',[]) and
         'offsec.com' not in ' '.join(r.get('url','') for r in json.load(open(f)).get('references',[]))
         for f in glob.glob('commands/**/*.json',recursive=True)))
       PY

  2. Chain-anchor: command/payload/attack-chain cards with no recommended[] (or none with a
     next/prereq rel). Enforced by suggest-chains.js per module — run it, expect 0.

  3. CPTS HTB-link: every CPTS-sourced card carries its academy.hackthebox.com/module/details/<id>
     link. (The validator's "112 missing HTB link" warning is NON-CPTS cards — OSCP/CRTP/CWES/CDSA —
     that correctly reference their own platforms. Not a CPTS gap. Do not "fix" those.)

  4. mitre[] on command/payload/attack-chain cards. Sole sanctioned exemption: pure lab-setup
     cards with no attack semantics (e.g. gs-vpn-connect = "sudo openvpn user.ovpn"). Those may
     also skip defense{}. Everything else needs both.

  5. Every card has an explicit `id` and `type` (validate.js hard-errors on either missing).
     Every variation has a `label` (hard-error otherwise). No card relies on build-derived id -
     recommended[] links must point at an explicit id.

  6. Coverage: after processing any source, the Step 8.5 sweep reports ~0 uncarded techniques.
     No singleton top-level categories (fold 1-card categories into a sibling).

---

SOURCE MATERIAL LOCATIONS:

  CPTS modules (HTB Academy):
    Notes:      D:\moving\Archive\Security\CPTS notes\<NN Module Name>\
                  → "... - Commands.md"  (commands)
                  → "... - EXPLANATION NOTES.md"  (context, caveats, tips)
    Raw HTB:    D:\Security\CPTS FULL\<NN Module>.md

  CWES modules (HTB Academy — Web Exploitation):
    Notes:      D:\moving\Archive\Security\CWES Notes\<NN Module Name>\
    Raw HTB:    D:\Security\CWES FULL\<N Module>.md
                  → many overlap CPTS and are named "... (CPTS + CWES).md" (07 XSS, 08 SQLi,
                    09 SQLMap, 10 CmdInj, 11 File Upload, 13 Login Brute, 15 Web Attacks,
                    16 File Inclusion, 19 Attacking Common Apps).
                  → CWES-UNIQUE modules with no CPTS twin (prioritise these): 02 Intro to Web
                    Apps, 05 Web Fuzzing, 12 Server-Side Attacks, 14 Broken Authentication,
                    17 Attacking GraphQL, 18 API Attacks, 20 Bug Bounty Hunting Process.
                  → NOTE the inconsistent numbering: files 1–5 have no leading zero
                    ("1 Web Requests.md"), 06+ do ("06 JavaScript Deobfuscation.md").
    For a "(CPTS + CWES)" module already carded from CPTS: do the multi-cert merge (add CWES to
    certifications[], add the CWES module URL, append "Also covered in: CWES <module>" to notes) —
    do NOT duplicate the card. Only CWES-UNIQUE techniques become new commands/cwes/ cards.

  OSCP chapters (PEN-200 2024.11):
    Source:     D:\Downloads\O 2\OffSec - PEN-200 Book 2024.11 hide01.ir\
                  → "<NN>. <Chapter Name> hide01.ir.html"

  CRTP (Altered Security - Attacking & Defending Active Directory):
    Source:     the Lab Manual (.mhtml) + course slides (.pdf) + SlideNotes (.pdf) the user uploads.
                  → Lab Manual = command-rich (dollarcorp/moneycorp lab); slides = same techniques + theory.
    Cards:      commands/crtp/<phase>/*.json  (subcats: Foothold, Domain Enumeration, Local PrivEsc,
                  Domain PrivEsc, Lateral Movement, Persistence, Cross-Trust, Evasion)
    Course URL for references[]:  https://www.alteredsecurity.com/adlab
    NOTE: CRTP AD techniques overlap CPTS Module 13 - multi-cert merge where identical; the CRTP
    tradecraft layer (Loader.exe in-memory, InviShell/AMSI bypass, evasive-* Mimikatz verbs,
    coercion, RACE backdoors) is CRTP-unique. The exam is OFFENSIVE-only - defensive course content
    (Deploy-Deception, decoy users) is out of exam scope; skip unless asked.

  Azure / Entra ID (cloud identity - growing gap, add as encountered):
    Cards:      commands/azure/<phase>/*.json ; certifications ["AZ"] or the relevant cert.
    Techniques: device-code phishing, PRT theft, AZAD Connect, managed identities, illicit consent.

  Card files:
    CPTS-primary:  commands/cpts/<phase>/<technique>/*.json
    OSCP-primary:  commands/oscp/<technique>/*.json   (OSCP-unique techniques only)
    CWES-primary:  commands/cwes/
    CDSA-primary:  commands/cdsa/
    Cross-cert:    commands/_shared/

---

PROCESSING A CHAPTER OR MODULE — MANDATORY PROTOCOL:

Step 0 — Classify the module, then run the mechanical sweep BEFORE eyeballing.

  Module type decides the approach:
  • NORMAL module → full block-by-block (Steps 1–7).
  • CAPSTONE module (e.g. M28 Attacking Enterprise Networks) → it re-applies techniques from
    earlier modules. Default verdict for a reused technique is SKIP ("already carded in its home
    module") — only genuinely NEW techniques get cards (e.g. DotNetNuke in M28). Still read the
    whole thing; the note-taker's Commands.md may be near-empty for capstones, so work from the
    CPTS FULL raw file.
  • THEORY module (e.g. M01 Penetration Testing Process) → confirm it is command-free
    (grep -cE '```|shellsession' on the raw file → 0), then SKIP the module and LOG the skip in
    PROGRESS.md. Don't silently ignore it. (M27 looked like theory but was NOT — always verify.)

  Mechanical sweep (run these, don't rely on eyeballing the source):
    node coverage.js --module NN        # lists source cmds vs matched vs UNMATCHED
    node suggest-chains.js --module NN   # lists cards with no chain — expect 0

  Then TRIAGE every unmatched line. Fuzzy matcher over-reports; classify each:
    • distinct tool / distinct technique with no card        → GAP (PARTIAL or MISSING)
    • C/C++/PowerShell SOURCE fragments, echo-into-file lines → SKIP (source code, not a command)
    • setup/nav/transfer duplicates of a carded technique     → SKIP (conscious)
  The unmatched list is a review queue, not a to-do list — but you must consciously verdict each.

Step 1 — Extract every code block. No skimming.

  For OSCP HTML chapters, run this Python extractor:

    from html.parser import HTMLParser
    class CodeExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.in_code=False; self.blocks=[]; self.current=[]; self.depth=0
        def handle_starttag(self,tag,attrs):
            if tag in('code','pre'): self.in_code=True; self.depth+=1
        def handle_endtag(self,tag):
            if tag in('code','pre'):
                self.depth-=1
                if self.depth<=0:
                    self.depth=0
                    if self.current:
                        b=''.join(self.current).strip()
                        if b: self.blocks.append(b)
                    self.current=[]; self.in_code=False
        def handle_data(self,data):
            if self.in_code: self.current.append(data)
    with open("<chapter>.html",encoding='utf-8',errors='ignore') as f:
        p=CodeExtractor(); p.feed(f.read())
    for i,b in enumerate(p.blocks):
        print(f"=== BLOCK {i+1} ==="); print(b[:400]); print()

  For CPTS Markdown: extract every fenced code block.

  For MHTML (e.g. a CRTP Lab Manual saved as .mhtml) - decode MIME, take the HTML part, then run
  the same code/pre extractor above:
    import email, glob
    msg = email.message_from_file(open("<file>.mhtml", encoding="utf-8", errors="ignore"))
    html = max((p.get_payload(decode=True).decode("utf-8","ignore")
                for p in msg.walk() if p.get_content_type()=="text/html"), key=len)
    # feed `html` into the CodeExtractor above; strip prompts (PS C:\...>, C:\...>) to get commands.

  For PDF (course slides / SlideNotes) - pull text per page and grep command-ish lines:
    from pypdf import PdfReader
    for p in PdfReader("<file>.pdf").pages:
        for line in (p.extract_text() or "").split("\n"):
            # keep lines matching ^(Get-|Set-|Invoke-|Rubeus|\.\\|C:\\|winrs|Certify|SafetyKatz|...)

Step 2 — For EACH block, assign an explicit verdict. Every block. No silent skips.

  COVERED  — existing card has the exact tool, flags, and payload pattern. Not just the concept.
  PARTIAL  — existing card covers the concept but wrong specific tool, wrong flags, wrong payload
             variant, or missing this stage of the chain. A PARTIAL IS A GAP.
  MISSING  — no card exists for this technique at all.
  SKIP     — justify: terminal output only / structural boilerplate / social-engineering copy text

  Before ruling COVERED, OPEN the candidate card and read its command + examples[] +
  variations[] — NOT just its name. A technique that lives only in the card's notes[] (or only
  in defense{}) is NOT actionable → verdict PARTIAL, and the fix is to promote it to an example
  or variation (e.g. the DSInternals offline-NTDS path on sebackup-ntds-diskshadow, or the
  DNS-OOB XXE variant — both were notes-only until promoted).

  What NEVER counts as COVERED:
  • Card uses WMI exec; chapter teaches Wscript.Shell → PARTIAL
  • Card has the main attack; chapter also shows the delivery step → MISSING for the delivery
  • Card has generic DownloadString payload; chapter teaches powercat two-stage → PARTIAL
  • Card covers step 2 of a 3-step chain; steps 1 and 3 are absent → MISSING
  • Technique only appears in notes[]/defense{}, not in command/examples/variations → PARTIAL

Step 3 — Find existing cards before creating new ones:
  find commands/ -name "*.json" | xargs grep -li "<keyword>" 2>/dev/null

Step 4 — Patch vs new card:
  Patch  → gap is an additional example/variation/delivery step on an existing technique
  New    → technique genuinely absent, or specific enough to warrant its own card

Step 5 — For EVERY card touched (new or patched), verify ALL of:

  REFERENCES — must have ALL that apply:
  • Tool's official repo / docs / man page
  • Cert course page:
      OSCP  → https://www.offsec.com/courses/pen-200/
      CPTS  → https://academy.hackthebox.com/module/details/<id>
      CWES/CDSA/CRTP → relevant course/module URL
  • Rule: if "OSCP" is in certifications[], the OffSec URL must be in references[]
  • Rule: if "CPTS" is in certifications[], the HTB Academy module URL must be in references[]
  • For exploits: CVE advisory or write-up
  • For ATT&CK-tagged: attack.mitre.org/techniques/TXXX

  RECOMMENDED — must have at least one "next" or "prereq":
  • prereq  → what must be confirmed/done first (recon, enum, condition check)
  • next    → the natural follow-on after success
  • alternative → different tool/technique for the same goal
  • escalation  → what this access enables
  • cleanup     → artifact removal
  • RULE: if recommended[] exists but has ONLY alternative/escalation/cleanup — it's incomplete.
    Add a next or prereq.

  MULTI-CERT — when an existing card from cert A also covers cert B's chapter:
  • Add cert B to certifications[]
  • Add cert B course URL to references[] if not there
  • Append to notes: "Also covered in: OSCP PEN-200 Chapter 17" (or whichever)
  • Do NOT change source field — it records original authorship
  • Do NOT create a duplicate card

  OTHER FIELDS — every card must have:
  • opsec: "silent"|"quiet"|"moderate"|"loud" — be honest:
      loud     = exploits, mass brute/spray, LSASS dump, coercion, payloads
      moderate = scans, enum, fuzzing
      quiet    = single valid auth, file transfer, tunnel
      silent   = passive/offline (OSINT, cracking, reference)
  • mitre: ATT&CK sub-technique IDs where a TTP applies
  • tools[]: every tool used, so the Tool filter works
  • command: a TEMPLATE with <placeholders> — NEVER hardcoded IPs, usernames, or .htb domains
    (those go in examples[] only)

  GOTCHAS that will fail the build — check these on every new/edited card:
  • recommended[] links must resolve. Some cards have NO explicit "id" field (build derives it
    from filename) and those ids don't resolve as link targets — point recommended[] at cards
    that DO have an explicit "id". validate.js reports "broken recommended link -> X".
  • opsec is EXACTLY one of: silent | quiet | moderate | loud. "safe"/"none" fail validation.
  • Attack cards live under commands/cpts/attacking-apps/<app>/ with category "Exploitation" and
    subcategory = the app name (an app-named subcategory not in groups.js is a harmless --strict
    warning, consistent with siblings — it will still PASS).
  • command + variations[] are linted for hardcoded IPs / lab users / .htb domains — keep those in
    examples[] only. (steps[] and examples[] are exempt.)

Step 6 — Build and validate. Must PASS before session ends:
  cd D:\moving\Archive\Security\command-reference
  node build-commands.js   # regenerates js/commands.js, auto-runs validate
  node validate.js         # must report: PASS — N cards, no schema violations

Step 7 — Write PROGRESS.md log using this exact format:

  BLOCK-BY-BLOCK GAP ANALYSIS (N code blocks):
    Block 1:  <command snippet>  →  COVERED: <card-id>
    Block 3:  <command snippet>  →  PARTIAL: <card-id> uses X not Y
    Block 5:  <command snippet>  →  MISSING: no card covers this
    Block 7:  <terminal output>  →  SKIP: output only
    ...

  PATCHES:
    1. commands/<path>/<card>.json
       GAP: <exact description of what was missing and why it matters>
       FIX: <what was added — example labels, field names>

  NEW CARDS:
    1. commands/<path>/<card>.json — <one-line description>

  RESULT: X cards patched, Y net-new cards. Build PASS N cards.

Step 8 — Second verification pass (do this before declaring the module done):
  • node build-commands.js && node validate.js  → PASS, 0 hard errors.
  • Confirm every NEW card's recommended[] targets resolve (grep the target ids exist).
  • node suggest-chains.js --module NN  → 0 orphans.
  • Re-scan the source once more for any technique you verdicted fast — a capstone or a
    "theory" module especially. Confirm the module now has a PROGRESS.md entry.
  • If the user asked to sweep multiple modules, only call the whole job done after a final
    repo-wide build+validate PASS and confirming each module 02–28 has a PROGRESS entry.

Step 8.5 — COVERAGE MEASUREMENT (mandatory before claiming "everything is covered").
  Block-by-block can miss things. MEASURE it: extract every distinct offensive cmdlet, .exe tool,
  and mimikatz/rubeus module::verb from the source, and diff against the whole card corpus. Report
  the uncarded count - do not say "all covered" until it is ~0 (residual = non-techniques only:
  target services, browsers, generic netcat, provider flags).
    import re, glob, json
    SRC = open("<extracted source text>").read()   # all blocks + PDF text concatenated
    cmdlets = set(re.findall(r'\b([A-Z][a-zA-Z]+-[A-Z][a-zA-Z]+)\b', SRC))       # Verb-Noun
    exes    = set(x.lower() for x in re.findall(r'\b([\w\-]+\.exe)\b', SRC))
    verbs   = set(re.findall(r'\b([a-z]+::[a-z\-]+)\b', SRC.lower()))            # module::cmd
    CARDS = '\n'.join(open(f,errors="ignore").read() for f in glob.glob('commands/**/*.json',recursive=True)).lower()
    for name,S in [("cmdlets",cmdlets),("exes",exes),("verbs",verbs)]:
        missing = sorted(x for x in S if x.lower() not in CARDS)
        print(name, "NOT in any card:", missing)
  Triage each miss: distinct technique -> card it; target/browser/generic/flag -> SKIP (note why).
  This is the step that turns "I think it's covered" into a number. Run it for every source.

---

CARD QUALITY STANDARD — a card is DONE only when ALL of this is present:

DEPTH RULE (do NOT ship shallow single-command cards):
• variations[] — capture EVERY alternate form the source shows: different tool for the same goal
  (ffuf/gobuster/feroxbuster), different OS, different auth (rc4 vs aes256 vs cert), in-memory vs
  on-disk. If the source shows 4 ways, the card has 4 variations. A command card with 0 variations
  is a red flag - re-read the source.
• steps[] — if the technique is a sequence (enumerate -> request -> convert -> use), capture the
  whole chain in steps[], substituted and copy-ready. Every attack-chain type MUST have steps.


ATTACK SIDE:
• command         — template with <placeholders>
• variations[]    — alternate forms (different OS, flags, auth method)
• examples[]      — captioned {label, command} objects with concrete filled-in usage
• steps[]         — for multi-step sequences (attack-chain type cards)
• notes           — caveats, cleanup, cross-references from source material
• recommended[]   — chain links (prereq/next/alternative/escalation/cleanup)
• opsec           — REQUIRED (honest noise level)
• mitre[]         — ATT&CK IDs
• tools[]         — tool names
• references[]    — tool docs + cert course URL + CVE if exploit + MITRE page if ATT&CK tagged

DEFENSE SIDE (defense{} — populated from source material only, never invented):
• prerequisites   — what must be true for the attack to work
• why_it_works    — root cause / design flaw
• misconfiguration — the specific bad setting in concrete terms
• vulnerable_config — short snippet showing the insecure state
• secure_config   — the corrected version
• code_review     — (web/injection cards) grep patterns + red-flag code signatures to FIND the
                    vuln in source, plus the safe pattern. Answers "how would I spot this in a
                    codebase / debugging web files". Renders in the Understand tab.
• impact          — what success grants the attacker
• detection       — Event IDs, log sources, SIEM queries, behavioral indicators
• artifacts       — forensic evidence (files, registry keys, network IOCs, process artifacts)
• prevention      — MITRE M-IDs, GPO, patches, hardening steps
• evasion         — how attackers bypass the detections above
• sources[]       — ["HTB M##", "MITRE T####", "OSCP Ch##"] — required if any sub-field has content

The defense block is NOT optional on command/payload/attack-chain cards.
reference/cheatsheet/script cards skip defense.
```

---

## Quick reference for yourself

| What | Where |
|---|---|
| Project root | `D:\moving\Archive\Security\command-reference\` |
| CPTS notes | `D:\moving\Archive\Security\CPTS notes\` |
| CPTS raw HTB | `D:\Security\CPTS FULL\` |
| CWES notes | `D:\moving\Archive\Security\CWES Notes\` |
| CWES raw HTB | `D:\Security\CWES FULL\` |
| OSCP chapters (HTML) | `D:\Downloads\O 2\OffSec - PEN-200 Book 2024.11 hide01.ir\` |
| Card files | `commands/cpts/`, `commands/oscp/`, `commands/cwes/`, `commands/cdsa/` |
| Build | `node build-commands.js` |
| Validate | `node validate.js` → must say PASS |
| Coverage | `node coverage.js --module NN` |
| Chain suggestions | `node suggest-chains.js --module NN` |
| Placeholder vocab | `js/vars.js` |
| Card contract | `SCHEMA.md` |
| Workflow checklist | `AUTHORING.md` |
| Progress + backlog | `PROGRESS.md` |

The validator is the single source of truth for "is this done." Trust it over eyeballing.
