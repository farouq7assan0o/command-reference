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

## Use it

1. Download or clone the repo.
2. Open **`index.html`** in any modern browser. That's it — no build, no server.

(Or just visit the hosted site once it's live.)

---

## Add your own commands

Two ways, depending on whether you want to do it yourself or have me do it.

### Option A — Do it yourself (with an AI coding agent)

The library is plain JSON cards plus a few Node scripts, built to be **extended by an AI assistant**
(Claude Code, Cursor, etc.):

1. Open the project in your agent.
2. Paste the prompt in **[`NEW-SESSION-PROMPT.md`](NEW-SESSION-PROMPT.md)** and give it your source
   material — a Markdown command list, course notes, or a chapter export.
3. It generates cards under `commands/**`, then you run the gate:
   ```
   npm run check      # build + validate + healthcheck + coverage snapshot → "ALL GATES PASS"
   ```
4. Commit and (if hosting) redeploy.

Full contributor docs: **[`DEVELOPING.md`](DEVELOPING.md)** (architecture + protocol) and
**[`AUTHORING.md`](AUTHORING.md)** (the card schema + QA checklist).

### Option B — Have me deploy it for you

Prefer to just hand it off? Send me:

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
