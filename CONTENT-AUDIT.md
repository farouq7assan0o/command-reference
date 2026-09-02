# Content-Quality Audit — 2026-09-02

Goal: beyond "are the commands there," verify the **prose is correct** — notes, misconfigurations,
MITRE mappings, detection, defense — so the library is safe to study from for the exam.

## Method

Two passes, because prose correctness can't be proven one way:

1. **Automated fact-check across all 908 cards** — the objectively-verifiable claims, where
   exam-hurting errors actually hide: hashcat `-m` modes, John `--format`, Windows Event IDs,
   MITRE ID format + semantic consistency, reference-URL validity, OSCP-URL invariant, description
   length, internal consistency. (`audit.py`, run against the whole corpus.)
2. **Deep prose read** of a curated set of the highest-stakes, most error-prone cards (AD attack
   chain, delegation, privesc, and the web-injection families where `code_review` matters), reading
   `why_it_works` / `misconfiguration` / `detection` / `code_review` in full and checking each fact.

## Results

### Automated fact-check — clean

| Check | Result |
|---|---|
| hashcat `-m` modes (13100/18200/5600/1800/13400/1000/2100/19700/3200/22100/7300/22921) | ✅ all valid + correctly applied in context (verified IPMI 7300, SSH-key 22921, DCC2 2100) |
| John `--format` (krb5tgs / krb5asrep / netntlmv2 / ripemd-128) | ✅ correct |
| Windows Event IDs on Kerberos cards (the classic trap) | ✅ AS-REP→**4768**, Kerberoast→**4769**, spray→**4625/4771**, all right |
| MITRE IDs — format | ✅ 0 malformed across 884 tagged cards |
| MITRE IDs — semantic contradictions on named techniques | ✅ 0 |
| Reference URLs malformed / duplicated | ✅ 0 / 0 |
| OSCP cards missing offsec.com URL (invariant) | ✅ 0 |
| Descriptions under 40 chars | ✅ 0 |
| Attack cards missing `mitre` or `defense` | 1 — `gs-vpn-connect` (sanctioned lab-setup exemption) |
| Defense blocks missing `sources[]` | ✅ 0 |

**Zero factual errors in the objectively-checkable content across all 908 cards.**

### Deep prose read — 1 defect found and fixed

Read ~12 diverse high-stakes cards in full. 11 were accurate and well-written (correct protocols,
attributes, APIs, and MITRE IDs — e.g. DCSync/DRSR, unconstrained/constrained delegation, RBCD,
PrintSpoofer, SQLi, SSTI, SVG-XXE, and the SSRF `code_review` grep patterns).

**One genuine defect:** `oracle-tns-file-upload` (Oracle ODAT `UTL_FILE` write) had a defense block
that was **generic web-upload / LFI boilerplate** — `why_it_works` described web-shell uploads,
`code_review` grepped for `include()/require()` (LFI), `misconfiguration`/`vulnerable_config`
described client-side upload validation. None of it matched the actual technique (a database→
filesystem write via Oracle's UTL_FILE package over TNS). **Fixed:** rewrote the whole defense block
to the real technique — UTL_FILE / DIRECTORY objects / `utl_file_dir`, sysdba over-privilege,
`GRANT EXECUTE ON UTL_FILE TO PUBLIC`, Oracle-specific detection/prevention/secure-config.

A heuristic scan (LFI-signature `code_review` on non-LFI cards; shared generic `why_it_works` text)
confirmed this was the **only** such mismatch — the 3 SSRF cards it also flagged are correct
(their `code_review` is properly SSRF-flavoured; `file_get_contents` is a shared sink).

### Structural fix — 11 attack-chains promoted to `steps[]`

`depth-check.js` flagged 11 CDSA-M06 attack-chain cards with **no `steps[]`** (protocol requires a
chain to capture its sequence in steps). Their ordered attack→detection→defense sequence existed but
was living in `examples[]`. Promoted the sequence into `steps[]` (renders as a proper numbered chain),
kept two quick-copy examples. Stepless attack-chains: **11 → 0.**

## What I did NOT do — and the honest limit

I did **not** read every sentence of all 908 cards. The automated pass covers the checkable facts
corpus-wide; the deep read covered a curated high-stakes sample. On that basis my confidence is
**high** that the content is correct and exam-usable, but I can't claim a line-by-line human-SME
review of all 905 pre-existing cards.

**Remaining, non-defect observations (informational, not errors):**
- **63 "shallow" cards** (0 variations/steps, ≤1 example) — mostly legitimately atomic single-tool
  cards (`mimipenguin`, `hashid-identify`, `pcredz`). An aid list for future enrichment, not wrong.
- **53 cards** with one empty core defense subfield — legit: offline *cracking* cards have no
  victim-side `detection`; Metasploit *workflow* cards (`msf-search`, `msf-sessions`) have no
  `detection`/`prevention`. Not errors.

## Verdict

For the exam: **the commands are all present, and the notes / misconfigurations / MITRE / detection
are correct** on every card checked — automated across the whole corpus for the hard facts, and read
in full for the high-stakes sample. One real prose mismatch existed (`oracle-tns-file-upload`) and is
fixed. 908 cards; `build` / `validate` / `healthcheck --render` all PASS.
