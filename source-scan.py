#!/usr/bin/env python3
"""
source-scan.py - portable, multi-format missed-command scanner.

Companion to coverage-all.js. coverage-all.js is the fast Node gate over Markdown/HTML sources;
this handles EVERY format a source might arrive in - Markdown, HTML, MHTML (saved web pages, e.g. a
CRTP Lab Manual) and PDF (course slides / slide-notes) - and diffs the distinct tool tokens against
the whole card corpus. Use it whenever new source material is dropped in, so the strict tool-level
scan can be re-run with one command instead of by hand.

  python source-scan.py <path-or-dir> [<path-or-dir> ...]     # scan explicit files/dirs
  python source-scan.py --cert crtp                           # scan a configured cert preset
  python source-scan.py --cert crtp --list                    # also print every uncarded token
  python source-scan.py --repo "D:/.../command-reference" ... # override repo location

PDF support needs pypdf:  pip install pypdf   (md/html/mhtml work with the stdlib alone).

A token that shows as "uncarded" is a REVIEW ITEM, not a confirmed gap: most are noise (lab
hostnames, variable names, config directives, C/C++ keywords). Triage each - distinct tool/technique
-> card it; label/target/keyword -> skip.
"""
import re, glob, os, sys, json, email, argparse
from html.parser import HTMLParser

# ---- machine-local cert source presets (override with CR_SRC_<CERT> env vars) ----
PRESETS = {
    "cpts": os.environ.get("CR_SRC_CPTS", r"D:/Security/CPTS FULL"),
    "cwes": os.environ.get("CR_SRC_CWES", r"D:/Security/CWES FULL"),
    "cdsa": os.environ.get("CR_SRC_CDSA", r"D:/Security/CDSA materials"),
    "crtp": os.environ.get("CR_SRC_CRTP", r"D:/Downloads/Active Directory/Active Directory"),
    "oscp": os.environ.get("CR_SRC_OSCP", r"D:/Downloads/O 2/OffSec - PEN-200 Book 2024.11 hide01.ir"),
    # supplementary CRTP files (mhtml + pdf); pass with --cert crtp-extra
    "crtp-extra": None,
}
CRTP_EXTRA = [
    r"D:/Downloads/Lab Manual.mhtml",
    r"D:/Downloads/Attacking_and_Defending_ActiveDirectory.pdf",
    r"D:/Downloads/Attacking_and_Defending_ActiveDirectory - SlideNotes.pdf",
]


class _CodeExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inc = False; self.blocks = []; self.cur = []; self.depth = 0
    def handle_starttag(self, t, a):
        if t in ("code", "pre"): self.inc = True; self.depth += 1
    def handle_endtag(self, t):
        if t in ("code", "pre"):
            self.depth -= 1
            if self.depth <= 0:
                self.depth = 0
                if self.cur:
                    b = "".join(self.cur).strip()
                    if b: self.blocks.append(b)
                self.cur = []; self.inc = False
    def handle_data(self, d):
        if self.inc: self.cur.append(d)


def _from_html(text):
    p = _CodeExtractor(); p.feed(text)
    return [ln for b in p.blocks for ln in b.split("\n")]


def _from_mhtml(path):
    msg = email.message_from_file(open(path, encoding="utf-8", errors="ignore"))
    parts = [p.get_payload(decode=True).decode("utf-8", "ignore")
             for p in msg.walk() if p.get_content_type() == "text/html"]
    return _from_html(max(parts, key=len)) if parts else []


def _from_pdf(path):
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.stderr.write("  [!] pypdf not installed - skipping PDF %s (pip install pypdf)\n" % path)
        return []
    out = []
    for pg in PdfReader(path).pages:
        out += (pg.extract_text() or "").split("\n")
    return out


def _from_md(text):
    lines, infence = [], False
    for ln in text.split("\n"):
        if ln.strip().startswith("```"): infence = not infence; continue
        if infence and ln.strip() and not ln.strip().startswith("#"): lines.append(ln.strip())
    lines += [m.group(1) for m in re.finditer(r"^\|\s*`([^`]+)`", text, re.M)]
    lines += [m.group(1) for m in re.finditer(r"`([^`\n]{3,200})`", text)]
    return lines


def extract(path):
    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".pdf":   return _from_pdf(path)
        if ext == ".mhtml": return _from_mhtml(path)
        txt = open(path, encoding="utf-8", errors="ignore").read()
        if ext in (".html", ".htm"): return _from_html(txt)
        return _from_md(txt)
    except Exception as e:
        sys.stderr.write("  [!] failed to read %s: %s\n" % (path, e))
        return []


def gather(target):
    if os.path.isdir(target):
        files = []
        for root, dirs, names in os.walk(target):
            r = root.replace("\\", "/")
            if "/Theory/" in r + "/" or "/.obsidian" in r or "/images" in r:
                continue
            for n in names:
                if os.path.splitext(n)[1].lower() in (".md", ".html", ".htm", ".mhtml", ".pdf"):
                    files.append(os.path.join(root, n))
        return files
    return [target]


def load_corpus(repo):
    parts = []
    for f in glob.glob(os.path.join(repo, "commands", "**", "*.json"), recursive=True):
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        if isinstance(d, dict) and d.get("_ignore"):
            continue
        parts.append(open(f, encoding="utf-8", errors="ignore").read())
    return "\n".join(parts).lower()


def tokens(lines):
    cmdlets, exes, verbs = set(), set(), set()
    for c in lines:
        cmdlets |= set(re.findall(r"\b([A-Z][a-zA-Z]+-[A-Z][a-zA-Z0-9]+)\b", c))
        exes |= set(x.lower() for x in re.findall(r"\b([\w-]+\.exe)\b", c))
        verbs |= set(re.findall(r"\b([a-z]+::[a-z0-9-]+)\b", c.lower()))
    return {"cmdlets": cmdlets, "exes": exes, "module::verb": verbs}


def main():
    ap = argparse.ArgumentParser(description="Multi-format missed-command scanner.")
    ap.add_argument("targets", nargs="*", help="files or dirs to scan")
    ap.add_argument("--cert", help="scan a preset: " + ", ".join(PRESETS))
    ap.add_argument("--repo", default=os.path.dirname(os.path.abspath(__file__)), help="repo root")
    ap.add_argument("--list", action="store_true", help="print every uncarded token")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    targets = list(a.targets)
    if a.cert == "crtp-extra":
        targets += CRTP_EXTRA
    elif a.cert:
        if a.cert not in PRESETS:
            sys.exit("unknown --cert %r (choices: %s)" % (a.cert, ", ".join(PRESETS)))
        targets.append(PRESETS[a.cert])
    if not targets:
        ap.print_help(); sys.exit(2)

    corpus = load_corpus(a.repo)
    carded = lambda t: t.lower() in corpus

    files = []
    for t in targets:
        if not os.path.exists(t):
            sys.stderr.write("  [!] not found (skipped): %s\n" % t); continue
        files += gather(t)
    lines = [ln for f in files for ln in extract(f)]
    tk = tokens(lines)

    result = {"files": len(files), "lines": len(lines), "groups": {}}
    for name, S in tk.items():
        uncarded = sorted(x for x in S if not carded(x))
        result["groups"][name] = {"total": len(S), "uncarded": uncarded}

    if a.json:
        print(json.dumps(result, indent=2)); return

    print("\n  source-scan  |  %d files, %d source lines  |  corpus: %s" % (len(files), len(lines), a.repo))
    print("  " + "=" * 60)
    for name, g in result["groups"].items():
        cd = g["total"] - len(g["uncarded"])
        pct = round(cd / g["total"] * 100) if g["total"] else 100
        print("  %-14s %d/%d carded (%d%%)" % (name, cd, g["total"], pct))
        if a.list:
            for x in g["uncarded"]:
                print("       -", x)
    print("\n  Uncarded = review items, not confirmed gaps. Triage: distinct tool -> card; label/target -> skip.\n")


if __name__ == "__main__":
    main()
