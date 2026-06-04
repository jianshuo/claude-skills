# Feedback playbook (run by GitHub Actions)

You are resolving a website feedback issue. The issue title and body are in your prompt.

## If the title matches `revert: #<N>`
1. Open `.feedback/feedback-ledger.json`, find the entry with `issue == <N>`, read its `commit`.
2. Run `git revert --no-commit <commit>`. This stages the inverse change WITHOUT committing
   (the workflow commits it for you). If it conflicts, resolve the conflict so the net effect
   undoes that commit, and leave the resolution staged/unstaged (do NOT commit).
3. Do NOT edit the ledger or the dashboard, and do NOT commit — the workflow does that next.
4. Stop.

## Otherwise (a normal feedback issue)
1. Implement the smallest change to THIS website that satisfies the request in the issue body.
   - Match the site's existing conventions, templates, and style.
   - Touch only what the request needs. Do not refactor unrelated code.
2. If the request is unclear, unsafe, or out of scope, make NO change and leave the working
   tree clean — the workflow will detect "no changes" and comment back asking for detail.
3. Write a one-line, plain-language summary of what you changed to `.feedback/last-summary.txt`
   (Chinese is fine). Example: `把首页标题字号从 1.8rem 调到 2.5rem`.
4. Do NOT edit `.feedback/feedback-ledger.json`, do NOT commit, do NOT push — the workflow
   handles ledger, dashboard, commit, and deploy after you finish.
