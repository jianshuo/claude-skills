# Install playbook — wjs-looping-feedback

Follow these steps in the **target website repo** (the user's current working directory).
Ask the user only TWO things: the allowlist usernames and which auth to use (OAuth token or API key).

## 0. Preconditions
- Confirm the cwd is a git repo with a GitHub remote: `gh repo view --json nameWithOwner -q .nameWithOwner`.
  Save this as `<REPO>`. If `gh` is not authenticated, ask the user to run `gh auth login`.

## 1. Detect the site type
Run the bundled detector against the repo root:
`node <SKILL_DIR>/scripts/detect-site.mjs .`
Map the result to a dashboard output path and a widget injection target:

| type    | config.json `out`                | inject widget into                                   |
|---------|----------------------------------|------------------------------------------------------|
| hugo    | `static/_feedback/index.html`    | `layouts/partials/feedback-widget.html` included before `</body>` in `layouts/_default/baseof.html` (copy baseof from the theme into project `layouts/_default/` first if absent) |
| nextjs  | `public/_feedback/index.html`    | a raw block / `<Script>` in `app/layout.tsx` or `pages/_document` before `</body>` |
| astro   | `public/_feedback/index.html`    | before `</body>` in `src/layouts/*.astro` base layout |
| static  | `_feedback/index.html`           | before `</body>` in every top-level `*.html` (or the shared template/partial if one exists) |
| node    | `public/_feedback/index.html`    | inspect the project to find the HTML shell; ask the user if ambiguous |
| unknown | `_feedback/index.html`           | ask the user where the site's HTML shell lives        |

Confirm the chosen `out` directory is actually published at the site root (Hugo `static/` and most
`public/` dirs are copied verbatim, so `/_feedback` resolves). If unsure, ask the user.

## 2. Copy runtime assets into the target repo
Create `.feedback/` and copy from `<SKILL_DIR>/assets/`:
- `feedback-lib.mjs`, `feedback-finalize.mjs`, `INSTRUCTIONS.md`, `feedback-ledger.json`
- Copy `config.sample.json` to `.feedback/config.json`, then set its `out` to the path chosen in step 1.
- Append `.feedback/last-summary.txt` to the target repo's `.gitignore` (create `.gitignore` if absent) so the transient summary file is never committed.

Copy the workflow:
- `.github/workflows/feedback.yml`  (from `assets/feedback.yml`, unchanged)

## 3. Inject the widget
- Copy `assets/feedback-widget.html`, replace `{{REPO}}` with `<REPO>`.
- Insert it at the injection target from step 1 (before `</body>`). For Hugo, prefer creating
  `layouts/partials/feedback-widget.html` and adding `{{ partial "feedback-widget.html" . }}`
  before `</body>` in the project's `baseof.html`.

## 4. Ask the user the inputs, then set repo config
- Ask: "允许哪些 GitHub 用户名提交反馈？（逗号分隔）" → `<ALLOWLIST>`
- Ask which auth to use:
  - **Pro/Max 订阅（推荐）**: have the user run `claude setup-token` locally and paste the token → `<OAUTH>`, then `gh secret set CLAUDE_CODE_OAUTH_TOKEN -b "<OAUTH>"`
  - **API key**: `gh secret set ANTHROPIC_API_KEY -b "<KEY>"`
  Set exactly ONE of the two secrets.
- Apply:
  ```bash
  gh variable set FEEDBACK_ALLOWLIST -b "<ALLOWLIST>"
  # then ONE of:
  gh secret set CLAUDE_CODE_OAUTH_TOKEN -b "<OAUTH>"   # Pro/Max
  gh secret set ANTHROPIC_API_KEY       -b "<KEY>"     # API billing
  gh label create feedback -c "0e8a16" --force
  gh label create revert   -c "b60205" --force
  ```
- Ensure Actions can push to `main`:
  `gh api -X PUT repos/<REPO>/actions/permissions/workflow -f default_workflow_permissions=write`

## 4.5 Wire up deploy triggering (DON'T SKIP — site won't go live otherwise)
The feedback workflow pushes the change to `main` with the built-in `GITHUB_TOKEN`. Whether
that push actually deploys depends on how the site ships. Determine the deploy mechanism and
act accordingly:

- **External push-deploy host** — Cloudflare Pages (git-connected), Vercel, Netlify, etc.
  Their integration webhook fires on every push, including `GITHUB_TOKEN` pushes, so the
  bot's commit deploys with no extra wiring. **Nothing to do.**

- **Deploy is a GitHub Actions workflow in THIS repo** — most commonly **GitHub Pages via
  Actions** (`actions/deploy-pages`), or any custom `on: push` build-and-deploy workflow.
  GitHub's recursion-prevention rule means a push made with `GITHUB_TOKEN` will **not**
  trigger another workflow, so that deploy workflow's `on: push` never fires and the change
  lands on `main` but never goes live. **Fix:** add a `workflow_run` trigger to the deploy
  workflow so it runs after the feedback loop completes:
  ```yaml
  on:
    push:
      branches: [main]
    workflow_dispatch:
    workflow_run:
      workflows: ["feedback-loop"]   # must match `name:` in feedback.yml
      types: [completed]
  ```
  (`feedback-loop` is the `name:` of the workflow in `feedback.yml`.) If the repo has no
  deploy workflow yet (fresh GitHub Pages site), create one — a standard Hugo/Next/Astro →
  Pages build workflow with the three triggers above — and set Pages source to "GitHub
  Actions" (`gh api -X POST repos/<REPO>/pages -f build_type=workflow`).

- **Manual / local deploy** (e.g. local `wrangler`): the loop still lands changes on `main`,
  but they won't auto-deploy. Tell the user this explicitly so they know to deploy.

Verify after the first real feedback run that a deploy actually fired and the change is live.

## 5. Commit and push
```bash
git add .feedback .github/workflows/feedback.yml <widget-target-files>
git commit -m "Add wjs-looping-feedback: in-site feedback → auto-edit → auto-deploy loop"
git push
```

## 6. Tell the user how to verify
"打开网站，点右下角『💬 提个建议』，输入一句改动建议并提交 → 在 GitHub 上 Submit 那个
预填好的 issue → 观察 Actions 跑完 → 刷新网站看改动 → 访问 /_feedback 看台账并可一键回滚。"
