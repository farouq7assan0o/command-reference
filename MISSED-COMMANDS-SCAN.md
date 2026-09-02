# Strict Missed-Command Scan — 2026-09-02

**Method.** Tool-level extraction (distinct `Verb-Noun` cmdlets, `*.exe` binaries, `module::verb`
tokens, and technique keywords) from every source, diffed against the full 905-card corpus
(command + variations + steps + examples + tools + notes). This is the trustworthy completeness
signal per the protocol; fuzzy line-coverage over-reports (payload literals, SQL/C/PHP source
fragments) and is used only as a review queue. Every flagged token was triaged against the raw
source before being called a gap or a skip.

**Baseline.** 905 real cards. (`commands/` holds 1065 `.json` = 905 cards + 160 `_ignore`
tombstones; `node build-commands.js` → `PASS — 905 cards`, healthcheck PASS.)

## Bottom line

| Cert | Verdict | Notes |
|---|---|---|
| **CPTS** (M02–M28) | ✅ Complete | Tool coverage 89–100%. No genuine missing offensive commands. |
| **CWES**-unique (02/05/12/14/17/18/20) | ✅ Complete | All web techniques carded. One soft item: CORS. |
| **OSCP**-unique (AWS, DPI-tunneling, client-side) | ✅ Complete | AWS, chisel/dnscat, HTA/macro/regsvr32 all carded. |
| **CDSA** (M01–M15) | ✅ Complete | Flagged tokens were malware-sample names / benign examples. |
| **CRTP** (Lab Manual + AD folder + slides + slidenotes) | ⚠️ **Real gaps** | ~12 PowerView enum primitives + a few tradecraft items absent from the entire corpus. |

**Four of five certs hold up under a strict scan. CRTP is the only place commands got missed** —
expected, since CRTP has just 48 cards for a very command-dense course.

---

## CPTS — complete (triage of every flagged tool)

| Flagged | Module | Verdict |
|---|---|---|
| `msfpayload`, `msfupdate`, `msfencode` | M09 | SKIP — source calls them "the old way / before 2015"; `msfvenom` is the carded replacement. |
| `fuser` | M10 | SKIP — false positive: substring of "name**ofuser**" in prose, not a tool. |
| `ConvertFrom-SddlString` | M13 | Defense-side — it's the Event-ID-5136 SDDL-decode step in the *detection* section, not an offensive command. Belongs in a `defense{}` block, not a new card. |
| `CVE-2018-1999002` (Jenkins pre-auth chain) | M24 | Prose only (no runnable block); authenticated Jenkins Groovy RCE is carded (`jenkins-script-console-rce`, `jenkins-groovy-revshell`). Optional reference note. |
| `octopus_checker` | M24 | SKIP — lab binary being reversed with `gdb`; the technique (gdb/peda) is carded. |
| `Connect-VIServer` | M26 | SKIP — consumer of `Import-Clixml` cred decryption, which IS carded (`powershell-clixml-decrypt`). |
| `mysql.exe` | M11 | SKIP — `.exe` variant of the carded `mysql` client. |
| `get-sebackupprivilege` | M26 | Covered — `SeBackupPrivilege` technique carded (7 cards); the cmdlet-module variant could be a note. |
| `Get-ADObject`, `procmon`, `wordfence`, `timedatectl`, `umask`, `taskkill`, `driverview`, `darkarmour`, `mythic`, `Invoke-RestMethod`, `rconfig` | various | Already carded. |

Everything else the fuzzy pass flagged is lab usernames/passwords, config directives, C/C++
keywords, terminal-emulator names, or bare hosts/paths (non-command noise).

**Optional CPTS micro-improvements (not missed commands):** add a reference note for the Jenkins
pre-auth CVE-2018-1999002 + CVE-2019-1003000 chain; add the `Get/Set-SeBackupPrivilege` cmdlet
form as a variation; add `ConvertFrom-SddlString` to the ACL cards' detection notes.

## CWES-unique — complete

Concept coverage in the corpus: graphql (10), introspection (9), jwt (18), ssrf (14), ssti (6),
xxe (15), mass-assignment (5), oauth (15), saml (7), race-condition (5), host-header (8),
shellshock (4), xpath (7), gopher (8), api-* (6 cards), deserialization (2).

- **Not gaps** — *prototype pollution* and *NoSQL injection* are **not taught in the CWES source**
  (prototype pollution absent; NoSQL only incidental mentions), so they are correctly not carded.
- **Soft item — CORS.** Cross-origin/CORS misconfiguration is taught in *18 API Attacks* but is
  thin in the cards (1 hit). Worth confirming whether the source gives a runnable PoC to card.

## OSCP-unique — complete

AWS cloud (ch24/25): `aws-account-id-iam-enum`, `aws-cli-setup`, `aws-iam-full-dump`,
`aws-iam-privesc-backdoor`, `aws-iam-scope-permissions`, `aws-domain-cloud-recon`,
`aws-container-*` — all present. DPI tunneling (ch19): chisel (19), dnscat (18). Client-side
(ch11): HTA/macro/regsvr32 (43). No gaps. (`ligolo` is not in the OSCP source, so its absence is
correct.)

## CDSA — complete

Flagged `.exe` were malware sample names (`photo433.exe`, `sham2.exe`, `htb_sample_shell.exe`,
`pdf_reader.exe`, …) and browsers. `utilman.exe` is a **benign PE-import viewing example** in the
malware-analysis module, **not** the sethc/utilman accessibility backdoor (confirmed in source) —
not a gap. `Get-GPPPassword` is carded (`ad-gpp-autologin` / `gpp-decrypt`). `INetSim` is carded;
`FakeNet-NG`/`FakeDNS` are alternative service-simulation tools → optional variation only.

---

## CRTP — the real gaps

All items below are **0 hits anywhere in the 905-card corpus** and appear in the CRTP source
(Lab Manual + AD Commands folder + slides). The existing 7 CRTP enumeration cards cover the
headline functions (Get-Domain, Get-DomainUser/Group/Computer, Find-InterestingDomainAcl,
Find-DomainUserLocation, Get-DomainTrust, Get-DomainGPO) but not the enumeration primitives below.

### A. PowerView enumeration primitives — genuine technique gaps

| Missing | What it does | Suggested placement |
|---|---|---|
| `Get-DomainSite`, `Get-DomainSubnet`, `Get-NetComputerSiteName` | AD **sites & subnets** topology mapping | **New card** (network-topology enum — not carded in any form) |
| `Find-DomainProcess` | Hunt processes across the domain (find where a tool/admin runs) | **New card** or variation on user-hunting |
| `Find-DomainUserEvent`, `Get-DomainUserEvent` | Hunt logon events to locate users/admins | Variation on `crtp-powerview-userhunting` |
| `Get-NetLoggedon`, `Get-NetRDPSession`, `Get-RegLoggedOn`, `Get-LastLoggedOn`, `Get-LoggedonLocal` | Native PowerView **session / RDP / logged-on** hunting primitives | Variations on `crtp-powerview-userhunting` (currently 0 variations) |
| `Get-NetShare`, `Get-NetFileServer` | PowerView **share / file-server** discovery | Variations on `crtp-session-share-hunting` |
| `Find-InterestingFile` | Sensitive-file discovery on shares (PowerView equivalent of Snaffler) | **New card** or variation |
| `Get-PathAcl` | ACLs on a filesystem path (SYSVOL / share perms) | Variation on ACL enum |
| `Get-NetOU`, `Get-DomainManagedSecurityGroup` | OU / managed-security-group enum | Variations on `crtp-ou-gpo-enum` |
| `New-DomainUser`, `New-DomainGroup` | Create principals via PowerView (persistence) | Variation on a persistence card |

Pure helpers (fold as notes, not techniques): `ConvertFrom-UACValue`, `Convert-ADName`,
`ConvertTo-SID`, `Export-PowerViewCSV`, `Get-DomainSearcher`, `Resolve-IPAddress`.

### B. Tradecraft / evasion — genuine gaps

| Missing | What it does | Suggested placement |
|---|---|---|
| Mimikatz `crypto::capi`, `crypto::cng` | Patch CryptoAPI/CNG so non-exportable private keys become exportable (cert / AD CS theft) | **New card** (cert-key export) |
| `Invoke-CradleCrafter` | Download-cradle obfuscation (Invoke-Obfuscation family) | Variation on the obfuscation card (`Invoke-Obfuscation` is carded) |
| Nishang `Invoke-PowerShellTcpEx` | AES-**encrypted** reverse shell | Variation (base `Invoke-PowerShellTcp` is carded) |

### C. Borderline — variations on existing cards, not new cards

- `Install-ServiceBinary` — PowerUp service-binary hijack primitive; `crtp-powerup` exists → variation.
- `Set-DCPermissions` — grant DCSync via ACL; `crtp-acl-persistence` exists → variation.
- `SmartCardEnrollment-Agent` / `-Users` — AD CS enrollment; `crtp-adcs-esc3` exists → confirm/variation.

### D. Correctly excluded (not gaps)

- **Defensive, out of CRTP exam scope:** `Deploy-Deception`, `Create-DecoyUser`, `Deploy-UserDeception`.
- **Lab-renamed wrappers of the carded SafetyKatz/Loader.exe in-memory technique:** `Invoke-MimiEx`, `Invoke-TheKat`, `Invoke-TheKatEx`. The tradecraft (evasive in-memory Mimikatz) is already carded; the lab-specific names are artifacts.
- Lab hostnames (`DCORP-*`, `EU-DC`), lab crypto helpers (`Encrypt/Decrypt-Base64AES256`).

---

## Status — DONE (2026-09-02)

**CRTP gaps authored and verified.** 3 new cards (`crtp-powerview-sites-subnets`,
`crtp-powerview-file-hunting`, `crtp-mimikatz-cert-export`) + ~18 variations/examples folded into
6 existing cards. Library now **908 cards**, `build` / `validate --errors-only` / `healthcheck
--render` all PASS. The CRTP AD-folder tool-gap went 28 → ~0 (residual = lab hostnames, PowerView
helper utilities, and `Invoke-MimiEx`/`Invoke-TheKat` lab-renamed wrappers of the already-carded
SafetyKatz technique). CPTS/CWES/OSCP/CDSA re-confirmed complete, including a line-level triage of
the heaviest CPTS modules (M10/M21/M24) — every unmatched line is a literal, source fragment, or
terminal output, not a missed technique.

Optional, not yet done (small): CPTS reference notes for the Jenkins pre-auth CVE chain and the
`Get/Set-SeBackupPrivilege` cmdlet form; a CORS PoC card for CWES API Attacks if the source gives a
runnable example.

---

## Recommended action

The scan is done. The only cert needing work is **CRTP**: roughly **3–5 new cards**
(sites/subnets topology, domain process/file hunting, Mimikatz cert-key export) plus **~10
variations** folded into existing CRTP enumeration/persistence cards, and 3 optional CPTS notes.
None of it changes the 4 certs already confirmed complete.
