---
name: wjs-looping-feedback
description: Use when the user wants to add an in-site feedback loop to a website repo — a floating "提个建议" button where allowlisted visitors submit suggestions that become a GitHub Issue, which GitHub Actions turns into an automatic code change via Claude Code, auto-merges and deploys, and records on a /_feedback dashboard with one-click revert. Triggers — "给网站加个反馈对话框", "提一句话就自动改网站", "装上反馈闭环", "feedback loop", "/wjs-looping-feedback".
---

# wjs-looping-feedback

Installs a self-driving feedback loop into any website repo. Runs entirely on the repo
owner's own GitHub Actions, authenticated with their Pro/Max OAuth token or their own
`ANTHROPIC_API_KEY` — no extra service or backend.

## What it installs
1. A floating feedback button (prefills a GitHub Issue — no backend, no keys client-side).
2. `.github/workflows/feedback.yml` — allowlist gate → Claude Code Action → auto-commit →
   push to `main` (auto-deploy) → ledger + dashboard update → close issue.
3. `/_feedback` dashboard — every suggestion, what Claude did, commit, status, one-click revert.
4. `.feedback/` runtime: `feedback-lib.mjs`, `feedback-finalize.mjs`, `INSTRUCTIONS.md`,
   `feedback-ledger.json`, `config.json`.

## How it works
visitor clicks button → fills suggestion → prefilled GitHub Issue (label `feedback`) →
Actions checks the author is in `FEEDBACK_ALLOWLIST` (else closes the issue) →
Claude Code edits the site per `.feedback/INSTRUCTIONS.md` → workflow commits to `main`,
updates the ledger + dashboard → the deploy ships it →
the issue gets a comment with the commit and a link to `/_feedback`.
Revert is the same loop driven by a `revert: #N` issue.

### Deploy triggering — read before you install (common gotcha)
The workflow pushes to `main` with the built-in `GITHUB_TOKEN`. Two cases:
- **External push-deploy host** (Cloudflare Pages git-connect, Vercel, Netlify): their
  webhook fires on every push, so the bot's commit deploys automatically. Nothing to do.
- **Deploy is itself a GitHub Actions workflow in the SAME repo** (e.g. GitHub Pages via
  Actions): GitHub deliberately does NOT let a `GITHUB_TOKEN` push trigger another workflow
  (recursion prevention), so the deploy workflow's `on: push` will NOT fire — the change
  lands on `main` but never goes live. Bridge it by adding a `workflow_run` trigger to the
  deploy workflow (see `references/install.md` step 4.5).

## To install
Read `references/install.md` and follow it in the target repo. It detects the site type
(Hugo / Next.js / Astro / static), copies assets, injects the widget, and asks the user for
exactly two things: the **allowlist** of GitHub usernames and the **auth** (Pro/Max OAuth
token via `claude setup-token`, or an `ANTHROPIC_API_KEY`).

## Scope (route 1)
Runs in the user's own repo with their own auth. Submitters need a GitHub account; only
allowlisted authors trigger work. Not a hosted service — no anonymous submit, no billing,
no multi-tenant. (A future GitHub-App packaging would reuse every asset here.)
