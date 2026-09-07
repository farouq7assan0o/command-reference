# Add-Commands Prompt

A ready-to-paste prompt for adding your own commands to this library with an AI coding agent
(Claude Code, Cursor, Copilot Chat, etc.). Open the project in the agent, paste the block below,
replace the last part with your commands/notes, and let it work. Then run `npm run check`.

For the deeper contributor workflow (redoing a whole cert module, coverage auditing, chain design)
see [`AUTHORING.md`](AUTHORING.md), [`NEW-SESSION-PROMPT.md`](NEW-SESSION-PROMPT.md) and
[`SCHEMA.md`](SCHEMA.md).

---

## The prompt (copy everything in the box)

```
You are adding commands to the "command-reference" project — a static, offline pentest command
library rendered from one JSON file per command (card). Work carefully and follow its contract.

STEP 1 — Learn the rules first (read before writing anything):
- SCHEMA.md      — the FROZEN card contract: every field, valid values, what renders.
- AUTHORING.md   — the workflow + the pre-commit QA checklist.
- js/vars.js     — the canonical <placeholder> vocabulary (which tokens to use).

STEP 2 — For each command I give you, create ONE JSON card at
commands/<cert>/<phase>/<technique>/<id>.json  (reuse an existing folder/category when one fits).
Follow SCHEMA.md exactly. A minimal card:

{
  "id": "kebab-case-unique-id",
  "name": "Human-readable title",
  "command": "tool -flag <ip> -u <user> -p <password>",
  "description": "1–2 clear sentences: what it does and why.",
  "platform": "linux",                          // "linux" | "windows"
  "type": "command",                            // command|payload|script|cheatsheet|reference|attack-chain|resource
  "category": "Enumeration",                    // the phase (Enumeration, Exploitation, ...)
  "subcategory": "SMB",                         // technique group; for privesc prefix the OS: "Linux - Sudo Abuse"
  "certifications": ["CPTS"],
  "source": "CPTS Module 04: Footprinting",     // or "Shared - Cross-Module Reference" under commands/_shared/
  "opsec": "quiet",                             // silent | quiet | moderate | loud
  "references": [ { "title": "tool docs", "url": "https://..." } ],   // >= 1
  "tools": ["smbclient"],
  "tags": ["smb", "enumeration"],
  "mitre": ["T1135"],
  "variations": [ { "label": "List shares", "command": "smbclient -N -L //<ip>" } ],
  "steps":      [ { "label": "Connect",     "command": "smbclient //<ip>/<share>" } ],
  "examples":   [ { "label": "Lab box",     "command": "smbclient -N -L //10.10.10.5" } ],
  "recommended":[ { "id": "another-existing-card-id", "rel": "next", "note": "why next" } ],
  "defense":    { "why_it_works": "...", "detection": "...", "prevention": "...", "sources": ["..."] }
}

STEP 3 — Hard rules:
- Turn EVERY target-specific value into a canonical <placeholder> from js/vars.js — lowercase:
  <ip> <user> <password> <domain> <dc> <nt_hash> <lhost> <lport> <url> <cidr> ...  (NOT <IP>, <TARGET_IP>).
  Keep concrete/literal values ONLY in "examples", never in "command"/"variations".
- Every card needs a non-empty "command", a "description", "opsec", and >=1 "references".
- Do NOT create duplicate "id"s. Link related cards with "recommended"
  (rel: next | prereq | alternative | escalation | cleanup) — ids must already exist.
- Capture everything the source shows: alternate syntaxes -> variations; ordered steps -> steps;
  filled samples -> examples. Don't drop a usable command — if it's not card-worthy on its own,
  add it as a variation/example/note on the closest existing card.

STEP 4 — Verify. Run:  npm run check
Fix anything it reports until it prints "ALL GATES PASS". (That runs build + schema validation +
a render sweep + the coverage snapshot.)

Here are the commands / notes to add:
<PASTE YOUR COMMANDS, CHEAT-SHEET, OR COURSE NOTES HERE>
```

---

## Tips

- **Small batch?** Just describe the commands in plain text after the prompt — the agent will
  template the placeholders and pick a category.
- **Whole course module?** Point the agent at your source notes and use
  [`NEW-SESSION-PROMPT.md`](NEW-SESSION-PROMPT.md) instead — it has the full module protocol and a
  coverage check so nothing is missed.
- **Not sure a command deserves its own card?** It probably belongs as a **variation / example /
  note** on an existing card. The agent is told to do that.
- Always finish with `npm run check`. Green = safe to commit and (if hosting) redeploy.
