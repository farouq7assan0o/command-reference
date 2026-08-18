# Card Schema - FROZEN CONTRACT

This is the single source of truth for how every command card is built. It is FROZEN.
Do not invent new fields or re-architect. If a new need appears, map it onto the fields
below. Every module (new and the 03-24 redo) follows this exactly, so we never have to
go back and redo modules because the structure changed.

The website (`js/app.js`) renders ONLY the fields listed here. Anything not listed is
invisible on the site - so never put real content in an unlisted field.

---

## The mental model - 4 distinct concepts (do not mix them)

| Field         | Meaning                                              | Renders as            |
|---------------|------------------------------------------------------|-----------------------|
| `command`     | THE canonical command for this card                  | big command bar + generator |
| `variations`  | the SAME command in another FORM (alt syntax, OS)    | tabs (Default + each) |
| `steps`       | an ORDERED sequence you run start-to-finish          | numbered Attack Chain |
| `examples`    | concrete illustrations of THIS command               | Examples list (captioned) |
| `recommended` | links to OTHER cards (what to run next)              | clickable next-cards  |

Rule of thumb:
- Alternative way to write the same thing -> `variations`.
- Steps that happen in order (wget -> load -> run -> verify) -> `steps`.
- A filled-in sample / related one-off of this command -> `examples`.
- "After this, go do X" where X is another card -> `recommended`.

---

## Fields (every card)

REQUIRED
- `id`         : unique kebab-case string. Never reused. (build fails / dedupes on clash)
- `name`       : display title.
- `command`    : NON-EMPTY top-level command string. Shown in the card list AND generator.
                 Even `reference`/`attack-chain` cards need a one-line summary here
                 (a `#comment` is fine) or they render a blank bar. THIS IS ENFORCED.
- `description`: 1-2 sentences, analyzed and clear (no fluff).
- `platform`   : "linux" | "windows".
- `category`   : phase. Existing set: Enumeration, Exploitation, Privilege Escalation,
                 Credential Access, Password Attacks, Web Exploitation, Reporting, ...
- `subcategory`: technique group. FOR PRIVESC: prefix with OS -> "Windows - Token Privileges",
                 "Linux - Sudo Abuse" (see OS grouping rule below).
- `type`       : "command" (default) | "payload" | "script" | "cheatsheet" | "reference"
                 | "attack-chain" | "resource".
- `certifications`: ["CPTS", ...]  |  `primary_cert`: "CPTS"
- `source`     : "CPTS Module NN: <name>" (used to find a module's cards later). For a command
                 that is NOT tied to a single module (a cross-module cheatsheet, reverse-shell
                 list, wordlist paths, TTY-upgrade trick), put the file under `commands/_shared/`
                 and set `source: "Shared - Cross-Module Reference"`. Shared cards are exempt from
                 the HTB-module-link reference check, but still need an authoritative reference.
- `references` : ARRAY, >=1, of {title, url}. Rendered as clickable "References and Documentation"
                 links in the builder. COMPOSITION RULE - each card should carry:
                   1. The TOOL's official page/repo/docs (where it's documented + downloaded) -
                      e.g. the GitHub repo, man page, or vendor doc. So the user knows the tool
                      and where to get it.
                   2. The HTB Academy MODULE link (where to review if stuck) -
                      `https://academy.hackthebox.com/module/details/<id>`. The validator
                      auto-derives each module's id and warns on cards that lack this link.
                   3. For exploits: the CVE / vendor advisory (NVD, MSRC, etc.).
                 Reference cards / cheatsheets: at least the authoritative source for the table.

OPTIONAL (use whenever the source has the content - capture everything)
- `requires`   : array e.g. ["local-access"], ["network-access"], ["credentials"].
- `protocols`  : array e.g. ["http"], ["smb"], ["mssql"].
- `tools`      : array of tool names (feeds the Tool filter).
- `tags`       : array of keywords (feeds search).
- `variations` : array of {label, command}. Tab 0 is always the top-level `command` ("Default").
- `steps`      : array of {label, command}. Ordered. Each step copyable. For attack chains.
- `examples`   : array. Each item is EITHER a plain string OR {label, command}.
                 Prefer {label, command} so each example has a caption for context.
- `notes`      : string. Short caveats, defaults, cleanup, reference lists. Preserves line
                 breaks (pre-wrap) - OK to put small tables here.
- `recommended`: array of {id, note?, rel?} - the attack-chain "next steps".
                 - `id`  : MUST be an existing card id (validator verifies; no self-links).
                 - `note`: OPTIONAL chain-specific "why do this next" ("now that you have an SPN").
                 - `rel` : OPTIONAL relationship, ONE of: "next" (default) | "alternative" |
                           "prereq" | "escalation" | "cleanup". The builder groups by this.
                 Do NOT store the target's title/description here - the app looks them up LIVE from
                 the target card, so renames never go stale. The builder also auto-shows a
                 "Reached From" section (reverse links) - you don't author those.
- `opsec`      : REQUIRED. Detectability of running this. ONE of: "silent" | "quiet" | "moderate" | "loud".
                 Every card must set it (validator warns and --strict fails if missing). Guide:
                 - silent   = passive / no packets to target (OSINT, offline cracking).
                 - quiet    = blends in / low noise (normal auth, single valid request).
                 - moderate = noticeable (scans, limited spraying, enumeration bursts).
                 - loud     = high detection risk (exploits, mass brute force, AV-triggering,
                              LSASS dumping, coercion). Shown as a colour-coded badge + filter.
- `exam`       : OPTIONAL. OSCP exam-legality flag. ONE of: "exam-ok" | "msf-one-machine" |
                 "restricted" | "lab-only". Only set on cards carrying the "OSCP" certification.
                 Rendered as a colour-coded badge (card list) + pill (detail), and searchable via
                 `exam:restricted`. Validator rejects any other value. Guide:
                 - exam-ok         = fully allowed, manual technique (no restriction).
                 - msf-one-machine = leans on Metasploit / Meterpreter / multi-stage msfvenom;
                                     on the OSCP exam these are permitted on ONLY ONE target, so the
                                     card should link (recommended) to a manual alternative.
                 - restricted      = automated exploitation NOT allowed on the exam (sqlmap auto-
                                     exploit, automated exploit frameworks, commercial tools). Learn
                                     the manual method; the card should point to it.
                 - lab-only        = useful for labs/learning but not exam-relevant.
                 Non-OSCP cards leave `exam` unset (no badge). Add "OSCP" to `certifications` on any
                 card the PEN-200 course covers; set `exam` at the same time.
- `mitre`      : array of ATT&CK technique IDs, e.g. ["T1003.001", "T1110.003"]. Rendered as
                 chips linking to attack.mitre.org, and folded into search (so "T1003" finds it).
                 Use the most specific sub-technique you can. Optional but encouraged for anything
                 that maps to a known TTP - it makes the library reusable for reporting.
- `lint_ignore`: array of lint check-ids this card has DELIBERATELY accepted, e.g.
                 ["hardcoded-literal"]. Use ONLY when a literal in the command/variations is
                 intentional (a variation that demonstrates a literal input FORMAT - IP ranges,
                 IP lists). The validator then stops flagging that card. Do not use it to dodge
                 real parameterization work.
- `defense`    : OPTIONAL object. Powers the 🛡 Defend and 💡 Understand tabs in the builder.
                 All sub-fields are optional strings — omit any you don't have sourced content for.
                 NEVER invent content here. Only populate from verified sources:
                   1. HTB module text (highest priority — cert-specific framing)
                   2. MITRE ATT&CK / D3FEND (technique pages, mitigation IDs, detection guidance)
                   3. Microsoft official docs (Event IDs, hardening, GPO settings)
                   4. SANS / CIS benchmarks
                 If a source is silent on a sub-field → leave it out. Placeholder shows in UI. Missing > invented.

                 ENRICHMENT RULE: Already-filled cards CAN and SHOULD be enriched with MITRE content.
                 HTB may say "message signing not required" — MITRE adds the Event ID, Sigma pattern,
                 and mitigation ID. Rule: HTB content stays first, MITRE content appended after.
                 Never overwrite what HTB wrote. Always append.

                 {
                   "prerequisites":"What must already be true for this technique to work — the
                                    preconditions. Valid creds? A foothold? A specific port/service
                                    open? A misconfig present? This is the connective tissue of an
                                    attack chain — it tells the reader what step comes BEFORE.
                                    Shown FIRST in 💡 Understand tab.",
                   "why_it_works": "Root cause — the design flaw or misconfiguration that makes
                                    this technique possible. For blue cards: also include what the
                                    attacker actually ran and what artifacts it leaves.
                                    Shown in 💡 Understand tab.",
                   "impact":       "What success GRANTS the attacker — creds, RCE, a shell, lateral
                                    movement, domain admin, data. Turns a command into a step with a
                                    purpose; tells the reader what the NEXT step becomes possible.
                                    Shown LAST in 💡 Understand tab.",
                   "detection":    "Event IDs, log sources, SIEM/SPL queries, behavioral indicators,
                                    Sigma rule patterns, honeytoken patterns. Shown in 🛡 Defend tab.",
                   "artifacts":    "Forensic evidence the technique leaves behind — files dropped,
                                    registry keys, log entries, process/command-line artifacts,
                                    network IOCs. Serves blue-team forensics AND red-team opsec
                                    (what to clean up). Shown in 🛡 Defend tab.",
                   "prevention":   "Patches, hardening steps, GPO settings, config changes, MITRE
                                    mitigation IDs (e.g. M1026, M1027). Shown in 🛡 Defend tab.",
                   "evasion":      "How attackers avoid the detection methods above. Cross-reference
                                    for red teamers; also helps blue team understand gaps.
                                    Shown in 🛡 Defend tab.",
                   "sources":      ["HTB M04", "MITRE T1110.001", "MITRE T1021.002"]
                                    Array of strings — list every source used across ALL sub-fields.
                                    REQUIRED whenever any other sub-field has content (validate.js
                                    hard-errors if content exists without sources). Shown as a small
                                    citation line at the bottom of the Defend tab.
                                    Use short labels: "HTB M##", "MITRE T####.###", "MS Docs", "CIS".
                 }

                   "misconfiguration": "The specific misconfiguration, insecure default, or
                                    vulnerable pattern that ENABLES this attack. Describe the
                                    bad setting/code in concrete terms — e.g. 'SMB signing
                                    disabled by default on Windows workstations', 'SSRF filter
                                    uses a blocklist instead of allowlist'. Shown in 💡 Understand
                                    tab after why_it_works.",
                   "vulnerable_config": "A short code or config snippet showing the INSECURE
                                    state — e.g. the bad GPO value, the nginx directive missing
                                    a restriction, the PHP code with no SSRF check. Keep it
                                    minimal and directly illustrative. Rendered as a red-tinted
                                    code block in 🛡 Defend tab.",
                   "secure_config":  "The corrected version of vulnerable_config — the hardened
                                    setting or patched code. Rendered as a green-tinted code
                                    block directly below vulnerable_config in 🛡 Defend tab."
                 }

                 VALID SUB-FIELD KEYS (validate.js hard-errors on any other key — this is what
                 catches typos like `why` instead of `why_it_works` that silently never render):
                   why_it_works · prerequisites · impact · detection · artifacts · prevention ·
                   evasion · sources · misconfiguration · vulnerable_config · secure_config
                 CVE / exploit / vendor-advisory links do NOT go in defense — they go in the
                 top-level `references` array (NVD, MSRC, exploit-db), same as always.

                 FULL STUDY MODE (target depth for command/payload/attack-chain cards):
                 A complete card lets a learner see the whole attack step —
                   prerequisites (what you need) → why_it_works (the flaw) → impact (what you gain),
                   then detection / artifacts / prevention / evasion for the blue side.
                 Populate every sub-field the sources actually support. Still NEVER invent: if HTB
                 and MITRE are both silent on `impact`, leave it out. Missing > invented, always.

                 Cards without a defense field render a placeholder message in those tabs.
                 The existing `notes` field is NOT replaced — defense is purely additive.

                 WHICH CARD TYPES GET DEFENSE CONTENT:
                   ✅ type=command, payload, attack-chain — always needs defense
                   ❌ type=reference, cheatsheet, script  — SKIP permanently (lookup tables)

## THE COMMAND IS A TEMPLATE (FROZEN, enforced by validate.js)

`command` and every `variations[].command` are TEMPLATES that the builder substitutes live.
Every target-specific value MUST be a canonical `<placeholder>`, never a literal:
  - IP/host -> `<ip>` (target) or `<lhost>` (your box, e.g. in reverse shells / file-server
    download lines); subnet -> `<cidr>`; domain -> `<domain>`; user -> `<user>`; and so on.
The CONCRETE lab values (10.129.x.x, inlanefreight.htb, htb-student, ...) go in `examples`, not
in `command`. A command with a baked-in IP shows "No parameters" in the builder and can't be
filled from the Target Context bar - that is a defect. `validate.js` has a **command lint** that
flags any hardcoded lab literal (IP ranges, `.htb`, known lab users) in command/variations; it
must be **0** (or the card must carry `lint_ignore: ["hardcoded-literal"]` for a genuine
illustrative case).

DO NOT rely on any other field name. `examples`/`steps`/`variations`/`notes`/`references`
are the only "extra content" slots the UI renders.

---

## Card type usage

- `command`     : a runnable command (default).
- `payload`     : a payload/shellcode/injection string to paste (the payload goes in `command`).
- `script`      : a multi-line script/loop.
- `cheatsheet`  : a themed group of related commands; put the primary in `command` and the
                  rest in `variations` (grouped tabs) and/or `examples`. Never leave commands
                  only in an unrendered place.
- `reference`   : a lookup table / non-runnable info. `command` = one-line summary (`#...`),
                  the table goes in `notes`, the source in `references`.
- `attack-chain`: an ordered multi-step / multi-tool procedure. `command` = summary line,
                  the ordered steps go in `steps`.

---

## Capture-everything policy (FROZEN)

This is a FULL exam reference. The user should not need the notes. Represent EVERY command
from a module. Mechanisms:
- alt forms -> `variations`
- filled-in / related one-offs, download-then-run pairs -> `examples` (captioned)
- ordered sequences, kill chains -> `steps` on an `attack-chain` card
- lookup tables (ports, EOL dates, files-of-interest, flag meanings) -> `reference` card
- lab navigation / cleanup lines -> keep as an `example` or a `steps` entry (context), not dropped

ONLY omit: exact-duplicate lab IPs / credentials / flags, and multi-file C/C++ source
samples (link the repo, keep the technique card).

SETUP THAT IS PART OF THE TECHNIQUE IS NOT A "SKIP". If a setup step is REQUIRED to actually run
the technique - deploy a tool to the pivot (`scp chisel ..`), edit `/etc/proxychains.conf`,
generate the pivot payload, register a plugin - capture it as `steps` on the relevant card so the
workflow is complete and copy-runnable. Only GENERIC environment setup that is not technique-
specific (`apt install`, `cd`, `pip install -r requirements`, navigating directories) is a
legitimate coverage skip. When coverage.js flags "setup", judge: integral to the technique -> add
it as a step; generic plumbing -> skip.

---

## Placeholder / engagement-variable vocabulary (FROZEN)

Commands use `<token>` placeholders. The Target Context bar fills them automatically - BUT
ONLY if the token is a CANONICAL engagement variable defined in `js/vars.js`. If you invent
a new spelling for an existing concept (`<target>`, `<rhost>`, `<victim_ip>` for the IP), the
bar can't fill it and the user must retype it on every card. So:

RULE 1 - Use the canonical name. When a value is part of the engagement context (something the
user sets once and reuses), write the CANONICAL token from `js/vars.js`, never a synonym:
  - IP/target host      -> `<ip>`        (NOT <target>, <host>, <rhost>, <IP>, <addr>)
  - port                -> `<port>`
  - user                -> `<user>`      (NOT <username>, <login>)
  - password            -> `<password>`  (NOT <pass>, <passwd>)
  - NT/NTLM hash        -> `<nt_hash>`   (NOT <ntlm_hash>, <nthash>)
  - domain              -> `<domain>` ; DC -> `<dc_ip>` / `<dc_host>`
  - your box / listener -> `<lhost>` / `<lport>`
  - URL                 -> `<url>` ; wordlist -> `<wordlist>` ; SMB share -> `<share>` ; DB -> `<db>`
  (See `js/vars.js` for the full list, labels, groups, and accepted aliases.)

RULE 2 - Genuine one-offs stay local. If a token is specific to ONE command and not reusable
context (`<uac_bit>`, `<snapshot_id>`, `<regex>`, `<page>`), just write it plainly. It still
gets a per-command field in the Command Builder. Do NOT force it into vars.js.

RULE 3 - A genuinely new REUSABLE variable -> add it to `js/vars.js` (one entry: key, label,
group, core, aliases). It then appears in the context bar automatically. No app code change.

HOW TO CHECK (run after every module): `node validate.js` prints a "Placeholder audit". Any
token used 3+ times that is NOT canonical is flagged - decide: rename to the canonical token,
add it as an alias in vars.js, or (if a true local) leave it. This is what stops variable
sprawl as the library grows past 1k commands.

---

## OS grouping rule (FROZEN)

Privilege-escalation cards group by OS in the tree:
- `category` = "Privilege Escalation"
- `subcategory` = "Windows - <technique>" or "Linux - <technique>"
(Module 13 AD ACL-abuse currently sits under "ACL Abuse"; fold into this scheme in the redo.)

---

## Integrity guard (run after EVERY module - must all pass)

Use the validator - it does everything the old inline snippet did, plus completeness, the
placeholder audit, and opsec/mitre checks:
```
node build-commands.js && node validate.js
```
Must report **0 hard errors** (empty commands, duplicate ids, missing references, broken
recommended links, invalid platform/type/opsec/mitre are all caught). Then review the
completeness table and placeholder audit. Full workflow + checklist in `AUTHORING.md`.

## Retiring old cards (IMPORTANT - deletes don't work on the mounted drive)

The workspace/bash CANNOT delete files under commands/ (mount returns "Operation not
permitted"). It CAN overwrite existing files and create new ones. So to REPLACE a module's
old cards during a redo:
1. Overwrite each old card file with a tombstone: `{"_ignore":true}` (one line).
2. `build-commands.js` skips any card with `_ignore:true` (already wired in).
Do NOT rely on fs.unlinkSync in a generator - it fails silently on the mount.
List a module's old files first: grep the source string, then tombstone those exact paths.

## Build order per module (FROZEN workflow)
1. Read the ENTIRE module Commands.md (every fenced block).
2. Write a `genNN.js` generator (all cards, using the fields above; every card has a
   non-empty `command`).
3. Run generator -> `node build-commands.js` -> run the integrity guard (all must pass).
4. Update PROGRESS.md checklist + running total + work-log entry.
