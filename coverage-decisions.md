# Coverage Decisions — Patient Re-Scrub (2026-08-26)

This is the "why did you skip that?" ledger. I re-audited **every** source line `coverage.js`
flags as *not covered* across CPTS, CRTP, and CWES, and judged each one instead of bulk-dismissing:

> Is this a real, pentest-usable command/technique that should be captured *somewhere* — a card, or
> a **variation / example / note** on an existing card — or is it genuine noise?

Conclusion: the library was already effectively complete for real techniques, but this stricter pass
found **7 genuinely-useful items that were being dropped**, and placed each on the right card rather
than letting it fall through. Everything else is documented below with a reason.

---

## 1. Added this pass (were being dropped → now captured)

| Item | Source | Placed on | Added as |
|---|---|---|---|
| `qwinsta /server:<t>` + `query user` | CPTS 13 | `ad-cme-loggedon` | 2 variations — native session enum from a foothold |
| Nishang `Invoke-PowerShellTcp` | CPTS 26 | `gs-reverse-shells` | variation — download-and-exec reverse shell |
| Kerberos clock skew (`KRB_AP_ERR_SKEW`) | CPTS 10/AD | `ad-getnpusers` | note — `ntpdate <dc>` fix before impacket/Rubeus |
| `ldapsearch-ad.py -t all` | CRTP/CWES | `ad-ldapsearch-users` | variation — automated LDAP enum |
| `gpresult /r` and `gpresult /z` | CRTP/CWES | `crtp-ou-gpo-enum` | 2 variations — applied GPOs on the current host |

These are exactly the case you flagged: not standalone-card material, but useful in an engagement —
so they now live as variations/notes on the closest existing card.

---

## 2. Reviewed and correctly NOT carded (with reason)

These survived the noise filter but, on inspection, should not become cards. Most are already
covered elsewhere, deprecated, GUI-only, or a concept/term rather than a runnable capability.

| Item | Source | Verdict | Reason |
|---|---|---|---|
| `get-adobject` | CPTS 13 | already carded | 7 cards use it (extractor missed it inside a pipeline) |
| `get-sebackupprivilege` | CPTS 26 | already carded | SeBackupPrivilege abuse is carded (7 cards) |
| `procmon64` | CPTS 24 | already carded | = Sysinternals procmon (6 cards) |
| `openssl.exe` | CRTP | already carded | `openssl` cert ops carded (20 cards); `.exe` = same tool |
| `s4u2self` / `s4u2proxy` | CRTP | already carded | Kerberos delegation, carded in constrained-delegation cards |
| `taskkill` | CPTS 26 | already carded | appears on a UAC-bypass card |
| `convertfrom-sddlstring` | CPTS/CRTP 13 | belongs in defense prose | blue-team helper to read Event 5136 SDDL — not an attack step |
| `msfpayload` / `msfupdate` | CPTS 09 | deprecated | merged into `msfvenom` (carded); no longer used |
| `msconfig` | CPTS 10 | not an attack | Windows GUI system-config utility |
| `dbeaver` | CPTS 11 | GUI client | a DB browser, not a technique (SQL attacks are carded) |
| `connect-viserver` | CPTS 26 | out of scope | VMware PowerCLI connect; niche, not core CPTS |
| `pyenv` / `bundle` | CPTS 24/12 | setup | language version / dependency managers |
| `umask` / `fuser` / `start-sleep` / `timedatectl` | CPTS 10/25/26 | utility/context | shell utilities; clock-skew captured as a note (above) |
| `attr_accessible` | CPTS 24 | source keyword | Rails mass-assignment code, not a runnable command |
| `wordfence` | CPTS 24 | not a tool | a WordPress plugin being scanned |
| `octopus_checker` / `nessus_help` | CPTS 24/09 | lab artifact | a lab script name / help output |
| `shell-session`, `powershell-session`, `cmd-session` | CPTS 16/21/22 | fence label | code-block language tags, not commands (filter now drops them) |
| `referral`, `enc-part`, `parent-child` | CRTP | concept/term | Kerberos/AD terminology, not commands |
| `dcorp-*`, `moneycorp-dc`, `paris`, `europe`, `japan`, `company.local`, `contoso.local`, `john.smith`, `websvc` | CRTP | lab literal | lab hostnames / domains / usernames — belong in `examples`, not as tools |

---

## 3. Noise categories (auto-skipped, correctly — never card these)

The raw `coverage.js` line count is dominated by non-command lines inside code fences. These are
**correctly** left uncarded; the tool now buckets most as `non-command noise`:

- variable assignments (`IP=10.129.x.x`), bare IPs / hostnames / file paths / URLs
- wordlist contents & username lists (`baseball`, `california`, `mark`), hash values, hashcat
  rule-file lines (`c $1 $9 …`)
- file-extension bypass lists (`.php`, `.jpg.php`, `.phar` — module 21), multipart form boundaries
- config-file contents (Apache/nginx, `ServerName`, `DocumentRoot`), robots.txt, HTML/JS page source
- SQL keywords (`select`, `union`), HTTP headers (`Cookie`, `Content-Type`), source-code keywords
- tool help dumps (`tool -h`), editor steps (`nano file`), interactive-console verbs (msf `show`/`set`)
- lab-literal one-offs already covered by a templated card (`mysql -u tom -pXXXX` → the mysql card)

---

## 4. How to reproduce

```
node coverage.js --module NN            # line-level review list (noisy by nature — see §3)
node coverage.js --module NN --tools    # TOOL-level coverage % — the trustworthy completeness signal
```

Tool-level coverage reads ~90–100% per CPTS module; every real attack tool is carded. Re-run
`--tools` after adding or redoing any module and card only genuine tool gaps (see `AUTHORING.md` →
"Coverage & completeness"). The bar for a *new card* is: a distinctive tool/technique the cert
teaches that appears in NO card. The bar for a *variation/example/note* (this pass) is: a real,
usable command that belongs alongside a technique already carded.

---

## 5. OSCP + CDSA scrub (2026-08-26)

Extended the audit to the two sources not previously deep-checked. CDSA is markdown; OSCP (PEN-200)
is HTML, so the miner extracts only **prompt-prefixed command lines** from `<pre>` blocks (not the
command output that fills those blocks).

- **CDSA: 0 uncarded tools** — fully covered at the tool level.
- **OSCP: 0 genuine gaps.** Six tokens flagged, all resolved: `winpeas.exe` (winpeas is carded, 9
  cards), `dnsmasq` (already noted on the `dnscat2` DNS-tunneling card), `nmcli` (NetworkManager
  config, not an attack technique), `chmodfix` / `met.exe` (lab-specific binaries), `meanwile` (a
  prose typo captured as a token).

Both certs confirmed complete. No additions required.

## 6. New: in-app coverage snapshot

`coverage-report.js` writes `js/coverage-data.js` (per-module tool-coverage %), surfaced in the
app under **Coverage → "Source coverage"** (green ≥95%, amber ≥80%, red below; hover a bar to see
any uncarded tools). Re-run `node coverage-report.js` after adding or redoing modules to refresh it.
