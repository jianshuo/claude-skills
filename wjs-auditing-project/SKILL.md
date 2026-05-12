---
name: wjs-auditing-project
description: Use when the user asks to audit what's wrong with a project, "make it right", "看看项目出了什么问题", "为什么用户的需求还没上线", "为什么没提交App Store", "为什么没新build", or wants a holistic state-of-the-project check covering unmerged branches, stalled PRs, failed GitHub Actions, stale builds, plan drift (TODOS.md / ROADMAP), unreleased commits, and log errors. Runs read-only investigation, presents a grouped checklist, fixes only after explicit user confirmation. Aware of the Cathier iOS app workflow (Xcode + fastlane + auto-merge @claude PRs from in-app feedback).
---

# wjs-auditing-project

## Overview

Holistic project-state audit. Find everything that's stalled, broken, or diverged from the plan — then fix it together after the user confirms the checklist.

**Hard two-phase split:**

1. **Investigate → present grouped checklist** (read-only; no commits, no merges, no pushes)
2. **Fix** — only after the user explicitly confirms what to do

Never collapse the phases. The user wants to see the full picture before any action. "Just go ahead and fix everything" is fine as confirmation, but you still produce the checklist first so they can scan it.

## When to use

- "看看现在的项目到底出了什么问题" / "make it right" / "what's broken"
- "为什么我的反馈还没上线"
- "为什么很久没有新 build / 没提交 App Store"
- "有没有 PR / 分支没合"
- Returning to a project after time away
- Before a release / TestFlight push, to make sure nothing is dangling

## Phase 1 — Investigate (parallel)

Run all the read-only checks in **one message with parallel Bash calls**. Don't ask the user which to run; run them all. Many will return "nothing wrong" — that's fine, those just don't show up in the checklist.

### A. Working tree & stashes
- `git status` — uncommitted work?
- `git stash list` — forgotten stashes?
- `git branch -vv` — local branches, ahead/behind tracking
- `git log --oneline main..HEAD` — what's on current branch not in main
- `git fetch origin --prune && git log --oneline HEAD..@{upstream}` — what's on remote not local
- `git branch -r --merged main` and `git branch -r --no-merged main` — remote branches still floating

### B. Open / draft PRs
- `gh pr list --state open --json number,title,isDraft,mergeable,mergeStateStatus,updatedAt,author,headRefName`
- For any PR older than 7 days OR with `mergeStateStatus` ≠ `CLEAN`: capture the failing checks via `gh pr checks <num>`
- Auto-merge bot PRs (per memory: in-app feedback → @claude PR → auto-merge): `gh pr list --author "app/claude" --state all --limit 20` — any merged but not yet in a TestFlight build? Any stuck open?

### C. CI / GitHub Actions
- `gh run list --limit 20 --json conclusion,name,headBranch,createdAt,databaseId,event`
- `gh run list --status failure --limit 10` — failures specifically
- For each failure on `main` or on an open PR's branch: `gh run view <id> --log-failed | tail -100` to capture the actual error

### D. Released vs unreleased work (iOS specifics for Cathier)
- `grep -E "MARKETING_VERSION|CURRENT_PROJECT_VERSION" *.xcodeproj/project.pbxproj | sort -u` — current version + build number
- `git tag --sort=-creatordate | head -5` — recent release tags
- `git log --oneline <last-tag>..main` — commits since last tagged release
- Check `fastlane/` config and `fastlane/report.xml` (if present) for last `pilot` / `deliver` invocation
- `git log -1 --format="%ai %s" -- fastlane/` — last fastlane change
- `git log --all --grep="bump\|version\|build" -10 --oneline` — recent version bumps

### E. Plan drift
- Read `TODOS.md`, `CHANGELOG.md`, `APP_STORE_SUBMISSION_GUIDE.md`, `ROADMAP.md`, `docs/plan*.md` if any exist
- Cross-reference plan items against shipped commits — what's listed but not done? What has a date that's already passed?
- `grep -rn "TODO\|FIXME\|XXX" --include="*.swift" .` — drift markers in source

### F. App / system logs
- `ls -t ~/Library/Logs/DiagnosticReports/Cathier* 2>/dev/null | head -5` — recent crash reports for the app
- `log show --predicate 'process == "Cathier"' --last 1d --style compact 2>/dev/null | grep -iE "error|fault" | head -20` — recent runtime errors (skip silently if no install on this Mac)
- `ls -t ~/Library/Developer/Xcode/DerivedData/*/Logs/Build/*.xcactivitylog 2>/dev/null | head -3` — last build attempts (existence + mtime; don't try to parse)

### G. User-feedback specifically
Per memory: in-app feedback creates @claude PRs that auto-merge into main. To answer "why isn't my feedback in the app":
1. Was a PR created from feedback? (`gh pr list --author "app/claude" --state all`)
2. Was it merged? (check PR status)
3. Is there a TestFlight/App Store build *newer than the merge commit*?
   If 3 = no, that's the answer: merged into main but never built/submitted.

## Presenting the checklist

Output **one** grouped markdown checklist. Each item must contain: what's wrong, evidence (numbers/dates/file paths), and a proposed action phrased so the user can say yes/no. Group by urgency:

```
## What I found

### 🔴 Blocking (these gate everything else)
- [ ] PR #42 "Add jokes redesign": 3 failing checks (SwiftLint, build, tests). Last commit 2026-04-30. → Read logs, fix, push?
- [ ] main is 7 commits ahead of last tag v1.4.0 (2026-03-22). No TestFlight build since then. → Tag v1.5.0 and prep release notes?

### 🟡 Open work
- [ ] Local branch `home-simplification` has 5 commits, no open PR, last activity 2026-05-08. → Open PR against main?
- [ ] Stash "WIP: brain trainer stats" from 2026-04-02. → Show diff and decide drop/apply?

### 🟢 Plan drift (TODOS.md / fastlane)
- [ ] TODOS.md line 14: "Submit App Store build by 2026-04-30" — overdue 11d, no `fastlane pilot` invocation since 2026-03-12.
- [ ] TODOS.md line 22: "Hook up haptics on streak page" — no matching commit on main.
- [ ] 2 auto-merged @claude PRs (#88, #91) from in-app feedback merged after last TestFlight build — user feedback shipped to main but not to TestFlight.

### Logs / errors
- [ ] 23 errors in last 24h matching "NSURLErrorDomain -1009" (offline path) — investigate or note as expected?
- [ ] 1 crash report from 2026-05-10 in DiagnosticReports — pull stack and triage?

### Looks fine
- Working tree clean, no orphan branches on origin, no failed CI on main this week.
```

End with: **"想让我把这些都修好吗？还是挑一部分？或者先讨论某一项？"**

## Phase 2 — Fix (only after user confirms)

Once the user confirms (full set, subset, or "all green and yellow but not the App Store one"):

1. **TaskCreate** a todo per confirmed item
2. Order: failing CI → branch merges → tags → version bumps → release notes → build prompt
3. Work them one at a time; mark done immediately, not in batches
4. After each fix, **re-run the corresponding check** from phase 1 to verify it's actually resolved
5. End with a short summary: fixed / skipped / requires-human

### What you can do autonomously
- Read failing CI logs, edit code, push the fix
- Open a PR with `gh pr create` for an unpushed branch
- Re-trigger a failed run with `gh run rerun <id>` after diagnosing why it failed (don't blindly rerun flaky-looking failures — find the root cause first)
- Merge a clean PR (`gh pr merge --squash --auto`) if the user said yes for that specific PR
- Bump `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` in `project.pbxproj`
- Add a CHANGELOG entry, tag the release with `git tag` (don't push tag until user confirms)
- Drop or pop a stash after showing the diff

### What requires the user to act
Print the exact command they should run with a leading `!`:
- `! fastlane pilot upload` — App Store / TestFlight submission signs the binary; needs them
- `! open Cathier.xcodeproj` — anything that needs Xcode archive UI
- Anything destructive: `git reset --hard`, `git push --force`, deleting branches

## Common findings → standard fixes

| Finding | Standard fix |
|---|---|
| Local branch ahead of main, no PR | Rebase on main, push, `gh pr create` |
| PR failing CI on same step twice | Read failed log, fix root cause, don't blindly rerun |
| Unreleased commits + stale TestFlight | Bump build number, tag, write release notes, prompt user to run `fastlane pilot` |
| Stash >30 days, unclear context | Show `git stash show -p <n>` to user, ask drop/apply |
| TODOS.md item with no commit | Surface to user — descoped or forgotten? Don't assume |
| Auto-merged feedback PRs newer than last build | The fix is *a new TestFlight build*, not more code changes |
| `fastlane/` untouched but plan says App Store deadline passed | Surface the deadline + last submission date; user decides priority |

## Red flags — STOP

| Thought | Reality |
|---|---|
| "I'll just fix it and skip the checklist" | No. The user asked specifically for the audit-then-confirm flow. |
| "The PR looks safe to merge, I'll do it" | Only if they confirmed *this PR* by name in their reply. |
| "I'll force-push to clean up history" | Never without explicit per-action confirmation. |
| "Let me close that stuck PR to tidy up" | Investigate first; the work may be salvageable. |
| "I'll submit to App Store on their behalf" | Never. Print the `! fastlane …` command and stop. |
| "The crash report is probably nothing" | Pull the stack and surface it. Let the user decide. |
| "Plan item is old, must be obsolete" | Ask. Don't delete plan entries. |

## Notes specific to this user / Cathier

- Default working dir: `/Users/jianshuo/code/Cathier`. Honor wherever invoked.
- Cathier is a SwiftUI iOS app with `fastlane/` for App Store / TestFlight.
- Plan source of truth lives in `TODOS.md` and `APP_STORE_SUBMISSION_GUIDE.md`. Read both.
- Memory note: in-app feedback → `app/claude` opens a PR → auto-merge to main. So "why isn't my feedback in the app" usually means *the merge happened but no new build was cut*. Check TestFlight build date vs PR merge date before investigating the code.
- `gh` is authenticated. `fastlane` is installed (Gemfile present).
- DESIGN.md is the visual source of truth; never propose UI fixes that conflict with it without flagging.
