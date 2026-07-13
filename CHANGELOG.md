# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [2026-07-13]

### Changed

- **`wjs-voicedrop`** — audio listing switched to a dedicated fast endpoint: `GET /files/api/recordings` is now the recommended way to list voice recordings (~0.5 s, index-direct, same data source as the app's "My Recordings" view), returning per-recording status fields (`hasArticles`, `isEmpty`, `blocked`, `hasTags`). The old generic `GET /files/api/list` filtered to `VoiceDrop-*.m4a` (~2.5 s full scan) is kept as a fallback for when other file types need to be browsed at the same time.

## [2026-07-05]

### Changed

- **`wjs-voicedrop`** — full server API sync (16 commits) expanding the toolkit with four new resource categories and a set of admin endpoints:
  - **文风语料（偷师）**: three new endpoints — `POST /files/api/style/collect` (add a sample article to the style corpus), `GET /files/api/style/dataset` (list corpus metadata: item count and total chars, no full text), `DELETE /files/api/style/dataset` (wipe the corpus). Corpus items live under `<scope>style/<id>.json`.
  - **服务端蒸馏** (`POST /agent/style/extract`): distills the accumulated corpus into a new versioned `CLAUDE.json` style entry in the background; also auto-generates a「你的写作风格」intro article. Requires a minimum corpus size (`totalChars` ≥ `min`); accepts `clearAfter: true` to wipe corpus after success. Errors: `400 insufficient-corpus` / `400 empty-dataset` / `500 distill-failed`.
  - **单篇重挖** (`POST /agent/restyle`): re-mines a single recording with a specific style version (`styleV` defaults to current head). Runs synchronously and returns the restyle result; `422` on failure, `400 bad-request` on bad params.
  - **社区** (Community feed): full set of endpoints — info-feed (`GET /files/api/community/list`), read a post with full body + photos + author (`GET .../get/<shareId>`), reply list (`GET .../replies/<shareId>`), share an article (`POST .../share/articles/<stem>.json`, optionally with `replyTo`), check if already shared (`GET .../shared/articles/<stem>.json`), unshare (`POST .../unshare/<shareId>`), report (`POST .../report/<shareId>`). Share and unshare require an Apple login session (`403 needs_apple_signin` otherwise); read operations accept any valid token. Shares are live pointers — editing the source article updates the community post instantly.
  - **Apple 登录** (`POST /files/api/auth/apple`): exchanges a Sign in with Apple `identityToken` for a session token scoped to `users/<sub>/`; required for all community write operations.
  - **Admin 专用端点**: documented a set of `FILES_TOKEN`-gated admin-only endpoints: per-user article/style read-write, community report queue and moderation (`resolve` with `remove`/`restore`), compute grant (single and batch, with optional expiry or `all:true`), full account balance list, LLM/mine log viewers, Anthropic health probe (direct vs ENAM relay), manual StatusHub push, prompt registry for mining prompt tuning, and the paint callback endpoint.
- **README** — updated `wjs-voicedrop` skills-table entry and dedicated section to reflect style corpus/偷师, server-side extraction, single-article restyle, community feed, Apple login, and admin endpoint additions; added `偷师` / `重新挖` / `voicedrop 社区` to the trigger-word list.

## [2026-07-04]

### Changed

- **`wjs-voicedrop`** — the articles list API (`GET /files/api/articles`) now returns an optional `tags` field per article: an array of tags written by the `tag_article` voice tool, removable by including `remove: true`. The field is absent when no tags exist.

## [2026-07-01]

### Changed

- **`wjs-distilling-style`** — added a default "one-shot" shortcut for everyday use: `references/oneshot-prompts.md` ships two standalone copy-paste prompts (Prompt A: Style Card + article → rewrite; Prompt B: samples → Style Card) that bundle the full 9-axis fingerprint, fact-skeleton discipline, and all 6 AI-tell countermeasures into a single call, replacing the multi-round judge blind-test loop with one inline self-check. The full judge-subagent + Turing blind-test pipeline is still there for production-grade or batch validation — the new guidance is "default to the one-shot; escalate to the full loop only when hard validation is needed."
- **README** — updated `wjs-distilling-style` skills-table entry and dedicated section to reflect the new lightweight default mode and clarify that the judge blind-test is for deep-validation only.

## [2026-06-30]

### Added

- **`wjs-evaling-voicedrop-prompts`** — new skill: evaluates whether a change to VoiceDrop's mining system prompt (`MINE_SYSTEM` in `agent/src/prompts/mine.js`) is actually better than the live version. Runs a local eval harness against a golden fixture set, dispatches blind pairwise judge subagents (A/B order randomised — half the fixtures put the candidate as A, half as B — using a different model family than the generator to eliminate position bias), aggregates a win-rate verdict, and promotes the candidate only when win-rate ≥ 70%, no deterministic regressions, and the user explicitly approves. Ships `references/judge-rubric.md` covering five scoring dimensions: structural completeness, 王建硕 voice fidelity, fact-skeleton preservation, sentence rhythm, and paragraph density. Triggers: `评估 prompt` / `挖矿 prompt 改好了吗` / `eval prompt` / `比一比两版 prompt` / `/wjs-evaling-voicedrop-prompts`.
- **README** — added `wjs-evaling-voicedrop-prompts` to the skills summary table and as a new subsection in section 1 "公众号 / WeChat".

### Changed

- **`wjs-voicedrop`** — expanded trigger surface: `vd`, `voicedrop`, and `口述` are now recognised as broad entry-point aliases for any VoiceDrop-related operation (recordings, articles, style, photos, mining, compute), in addition to the existing specific command triggers.

## [2026-06-29]

### Changed

- **`wjs-voicedrop`** — major expansion from a two-task companion (list articles + distill style) into a **full VoiceDrop API toolkit** covering all account resources with versioned CRUD:
  - **Authentication**: ships a built-in `vd-login.mjs` (Node ≥ 20, zero dependencies) implementing the 6+4 phone-device pairing protocol — the skill can now log itself in without any other tool. Also accepts an App-copied anon token.
  - **Articles**: list / read full body / write (versioned — every PUT appends a new version, HEAD advances) / version history / undo-redo (`PATCH /head`) / delete (including `.srt`, `.empty`, `.blocked` sidecar files).
  - **Style (`/files/api/style`)**: storage upgraded to versioned `CLAUDE.json` (schema-3, same history/undo/rollback system as articles). The old `download/upload CLAUDE.md` pattern is retired; `PUT /files/api/style` is now the single write path, with full `PATCH /style/head` rollback support. Style is automatically injected into the miner's system prompt on next mining run.
  - **Photos**: list (via `GET /list` filtered to `photos/`), upload, private download, and public (no-token) download via `/files/api/photo/<full-R2-key>`.
  - **Audio recordings**: list (via `GET /list` filtered to `VoiceDrop-*.m4a`, sorted by `uploaded` time — not filename, which is an unreliable clock), download.
  - **Operations**: mine trigger (Worker `POST /agent/mine/trigger`, or Pages fallback), compute-credit balance, ledger, public share link generation, WeChat draft posting.
  - **Full interface quick-reference table** added covering every resource and operation.
  - **Distill workflow** updated: sample material now taken from `articles[*].body` (finished Markdown prose) via the articles API; style written via versioned `PUT /files/api/style` rather than raw file upload.
- **README** — updated `wjs-voicedrop` skills-table entry and dedicated section to reflect the full API toolkit scope, new auth flow, and expanded resource coverage.

## [2026-06-25]

### Changed

- **`wjs-voicedrop`** — `list` mode redesigned: instead of listing raw R2 files grouped by type (pending recordings / processed articles / empty/silent files / style settings), it now calls the dedicated articles API (`jianshuo.dev/files/api/articles`) to surface completed articles with their title, stem, version number, and section count — ordered newest-first. The old file-browser view is replaced by an article-centric view. The `distill` mode now reads `articles[*].body` (finished Markdown prose) from the same articles API rather than raw transcripts when selecting sample material for style fingerprinting. New trigger phrase added: `voicedrop 文章`.
- **README** — updated `wjs-voicedrop` table entry and dedicated skill section to reflect the articles-API-based list mode and the new `voicedrop 文章` trigger phrase.

## [2026-06-21]

### Added

- **`wjs-voicedrop`** — new SKILL.md formalizing two companion tasks for the VoiceDrop iOS app: **list** (pulls all files from the R2 inbox at `jianshuo.dev/files` and groups them by type — pending recordings, processed articles, empty/silent files, style settings) and **distill** (extracts a compact writing-style rule set from sample articles in a format ready to paste into VoiceDrop's "Settings → Writing Style" field, with optional one-command upload via the Files API). Auth is a bearer token from the VoiceDrop app (Settings → Access Token) or `FILES_TOKEN` from `~/code/.env` for the admin. Triggers: `voicedrop list` / `列出 VoiceDrop 文件` / `voicedrop distill` / `蒸馏 VoiceDrop 文风` / `/wjs-voicedrop`.
- **README** — added `wjs-voicedrop` to the skills summary table and as a new subsection in section 1 "公众号 / WeChat".

### Changed

- **`wjs-distilling-style`** — three significant additions: (1) **Card form guidance** — the 9-axis fingerprint should expand into ~30–45 fine-grained actionable dimensions grouped in a table (sentence rhythm / punctuation / paragraph / vocabulary / tone / argument / metaphor / opening / closing / anchor discipline / red lines); anchoring examples stay in the distillation process but are kept brief in the final card so they're not misread as formulas; (2) **Turing blind-test protocol** — a second validation layer beyond the similarity judge: mix AI rewrites with real samples, have a fresh, different-model judge blindly classify each as "real" or "AI-written", aiming for ≤50% accuracy (guessing level); full procedure in `references/turing-blindtest.md`; 6 most common AI tell-signs and their counters in `references/ai-tells.md`; these 6 counter-measures should be embedded in every Style Card; (3) **Honest ceiling disclaimer** — for balanced test sets the floor is ~50%; single articles can fool even sharp judges (especially plain observation/narrative pieces); the skill's strongest use case is rewriting the author's own real material, not generating synthetic corpora.
- **`wjs-publishing-wechat`** — red highlight color standardized to pure `#ff0000` (was `#c0392b`); inline code style simplified (removed `font-size` override); related-articles section CSS cleaned up.
- **Marketplace** (`.claude-plugin/marketplace.json`) — renamed from `wjs-skills` to `claude-skills` to match the repository name; expanded skill registry from 14 to all 31 `wjs-*` skills so every skill can be installed by name.

## [2026-06-20]

### Added

- **`wjs-distilling-style`** — new skill: captures any writer's voice from a handful of sample articles and rewrites target text to match. Uses a 9-axis Style Fingerprint (sentence rhythm, paragraph length, vocabulary, tone, argument structure, metaphor use, emotional intensity, opening/closing conventions, author red lines) where each axis must be anchored with 2–3 verbatim sample sentences — abstract rules without real examples don't transfer. An independent "judge" subagent blind-tests every rewrite (only sees the Style Card anchors and the rewritten draft, never the original), scores each axis 1–5, and lists specific out-of-voice sentences; self-assessment is explicitly banned as the single biggest failure mode. A fact-skeleton discipline (list the source text's information points before rewriting, change only how things are said, never add or remove facts) prevents style transfer from becoming content editing. Style Cards are stored in a local `~/code/style-cards/<author-slug>/` library and never synced to the public repo, so others' drafts don't leak. Two modes: **distilling** (samples → `style-card.md`) and **rewriting** (target + Style Card → rewritten draft, up to 2–3 judge rounds). Triggers: `蒸馏文风` / `提炼XX的风格` / `把这篇改成XX的味儿` / `mimic this writer` / `match this author's style` / `/wjs-distilling-style`.
- **`wjs-publishing-appstore`** — new skill: companion to `wjs-publishing-testflight` covering the App Store submission step. Assumes the TestFlight CI pipeline is already in place and adds three scripts: `scaffold-metadata.sh` (creates the `fastlane deliver` metadata tree seeded from VoiceDrop copy), `shoot.sh` (scripted `simctl` screenshot capture — iPhone 6.9" is the only mandatory size for iPhone-only apps, one locale per run), and `release_lane.rb` (the `release` fastlane lane to paste into the existing Fastfile, with `submit_for_review: true` and encryption/IDFA compliance answers). Documents first-submission App Store Connect console prerequisites (age rating questionnaire expanded in 2025 with fields fastlane doesn't cover, pricing = Free, content rights, App Privacy nutrition label), iOS 26 Simulator quirks (mic-permission dialog cannot be suppressed via `simctl privacy grant`; ghost Liquid Glass tab labels are sim-only), the globally-unique `name` field trap, and the robust two-step ship pattern (let `beta` lane finish processing before dispatching `release skip_build:true`). Reference implementations: VoiceDrop and Cathier. Triggers: `提交 App Store` / `上架` / `app store 审核` / `准备截图和文案` / `submit for review` / `/wjs-publishing-appstore`.
- **README** — added `wjs-distilling-style` and `wjs-publishing-appstore` to the skills summary table; added `wjs-distilling-style` as a new subsection in section 9 "思维框架 / Perspective" and `wjs-publishing-appstore` as a new subsection in section 13 "iOS 持续集成 / iOS CI".

### Changed

- **`wjs-mining-voicedrop`** — safety change: R2 audio files are now **never deleted**. Previously the inbox entry was deleted from R2 after a confirmed successful run; now the skill marks processed files by creating sidecar marker files (`.processed` for completed items, `.empty` for short/silent files) in R2 instead of deleting them. This makes repeated runs idempotent without risking data loss if a step fails after the file has been downloaded but before the user confirms a draft.

## [2026-06-18]

### Added

- **`wjs-mining-voicedrop`** — new skill: closes the VoiceDrop loop on the Mac side. The VoiceDrop iOS app records a voice memo the moment you start speaking and uploads it to R2 as soon as you stop; this skill pulls every unprocessed `VoiceDrop-*.m4a` from the R2 inbox at `jianshuo.dev/files`, transcribes each one via `wjs-transcribing-audio` (Chinese: Volcano/豆包 ASR with AI typo correction), and passes the resulting SRT to `wjs-mining-articles` to produce WeChat public-account article drafts. The only new code is `scripts/voicedrop-inbox.sh` (`list` / `download` / `delete`, credentials read from `~/code/.env` at runtime and never written to code); everything else delegates to existing skills. Safety rule: R2 deletion only happens after a fully successful run (download to archive → transcribe → mine → user confirms at least one draft); on any failure — or if the user doesn't pick a topic — the file stays in the inbox for the next run. Short/zero-length files are detected via `ffprobe` and skipped without deletion. Triggers: `处理 VoiceDrop 录音` / `把新录音挖成文章` / `口述备忘变文章` / `处理一下我的录音` / `/wjs-mining-voicedrop`.
- **README** — added `wjs-mining-voicedrop` to the skills summary table and as a new subsection in section 1 "公众号 / WeChat".

### Changed

- **`wjs-publishing-wechat`** — two new mandatory workflow gates added (iterative updates across 7 commits):
  - **Step 1.5: 隐私扫描 (privacy scan)** — a hard gate inserted between polishing (Step 1) and title generation (Step 2): Claude scans every sentence for personal information — specific names, restaurant/venue names, precise locations/addresses, phone numbers, email addresses, WeChat IDs — and redacts or generalises any it finds before text is finalised. Uncertain items are surfaced to the user rather than silently deleted. Result is always reported: "隐私扫描：无" when nothing is found, otherwise each hit is added to the change log tagged "隐私". Detailed redaction rules and substitution examples live in `STYLE.md` section 10 (城市-level place names are kept; exact addresses and venue names are not).
  - **Step 5.5: 发布前选标题 (title selection gate)** — a hard gate inserted between file-pack creation (Step 5) and `upload-draft.sh` (Step 6): Claude must stop and present four title candidates — A (the current `meta.json` title, so "keep as-is" is explicit) plus B/C/D (three punchier alternatives grounded in real facts, concrete numbers, or counter-intuitive contrasts — never clickbait or marketing copy) — and wait for the user to pick one before uploading. The selected title is written back to `meta.json`; cover image is not regenerated unless the user asks.
  - Both gates appear as new items in the skill's Done Criteria checklist.

## [2026-06-17]

### Added

- **`wjs-publishing-testflight`** — new skill: sets up fastlane + GitHub Actions CI/CD for any iOS project, using the Cathier project as the reference implementation. Every push to `main` triggers a build on `macos-15` (Xcode 26.2): queries App Store Connect for the latest build number, increments it, runs `match` in readonly mode for code signing, builds an `app-store` IPA, and uploads to TestFlight. Auto-release logic fires on every 10th build (`build_num % 10 == 0`), bumping the minor marketing version and submitting to App Store review automatically; the developer can also trigger a release manually by changing `MARKETING_VERSION` in `pbxproj` and pushing. Ships three lanes (`beta`, `bump`, `release`), a complete `Appfile` / `Matchfile` / `Fastfile` / `Gemfile`, a ready-to-paste `build.yml` GitHub Actions workflow, and a step-by-step secrets setup guide. Triggers: `testflight` / `fastlane` / `自动构建` / `CI TestFlight` / `/wjs-publishing-testflight`.
- **README** — added `wjs-publishing-testflight` to the skills summary table and as new section 13 "iOS 持续集成 / iOS CI".

### Changed

- **`wjs-publishing-wechat` (`scripts/build-recent-articles.py`)**: The end-of-article related-reading block is now randomly shuffled (was newest-first), so every past article gets equal exposure rather than always surfacing the same recent ones. The section heading was also renamed from "最近文章" to "扩展阅读" to better reflect its purpose as a discovery aid rather than a chronological feed.
- **`wjs-publishing-wechat` (`scripts/upload-draft.sh`)**: Added a fixed Tokyo VPS proxy (`66.42.45.128:8888`) as the HTTPS/HTTP proxy for all outbound API traffic. This keeps the WeChat API exit IP stable and whitelisted, preventing intermittent `40164` (IP not in whitelist) errors that occurred when the local machine's IP changed.

## [2026-06-15]

### Changed

- **`wjs-publishing-wechat` — auto-injected "最近文章" link list**: `upload-draft.sh` now automatically appends a list of recently published articles to the end of each new post. Links use WeChat's native `mp_article_text_link` format (`data-linktype="2"`) so they are clickable in-app. The feature is driven by a new `scripts/build-recent-articles.py` helper that reads `publish.json` permalink ledgers from sibling article folders and writes an idempotent `<!--RECENT_ARTICLES_START/END-->` block into `article.md`. Defaults to 5 links; controlled by `WECHAT_RECENT_COUNT=N`. Disable with `WECHAT_PUBLISH_NO_RECENT=1`.
- **`wjs-publishing-wechat` — new `scripts/backfill-permalinks.py`**: One-time maintenance script that pulls the full published-article list from the WeChat MP web backend (`appmsgpublish` API, gated by browser session cookie) and backfills `permalink` + `published_at` into each local `publish.json` by exact title match. Auth via `WECHAT_MP_COOKIE`/`WECHAT_MP_TOKEN`/`WECHAT_MP_FAKEID` env vars or a session file at `~/.config/wjs-wechat/mp-session.env`. When credentials are configured, `upload-draft.sh` also calls this on each publish run to keep the ledger current. Supports `--dry-run`.
- **`wjs-publishing-wechat` (`scripts/gen-illustration.sh`)**: Removed the fixed center-crop to 1024×576 (16:9). The script now only resamples to 1024 px wide (proportional) and lets the model pick the aspect ratio that fits the content (3:2 / 4:3 for two-column comparisons, wide strip for single-row flows, portrait for deep hierarchies). This fixes labels being clipped at the top and bottom of tall illustrations.
- **`wjs-publishing-wechat` (STYLE.md)**: Added new "核心表达" section at the top: when writing about code or technical topics, explain every paragraph as if talking to a 5-year-old — no jargon, no showboating, and each small section should be self-contained enough to screenshot and discuss. Added an anti-pattern example: terse phrasing like "鸟晕了，矿工撤" reads as AI-generated and should be expanded into natural speech ("鸟如果晕了，矿工就需要撤了。"). Updated 摘要 (article summary) guidance: the goal is to hook readers using the "curiosity gap" model — surface the most counter-intuitive or highest-tension point in the article, then withhold the answer to pull readers in; plain-summary style is no longer the target.

## [2026-06-13]

### Changed

- **`wjs-x-increasing-follower`** — daily analytics ingested covering 2026-05-28 through 2026-06-12 (16 new days added to `state/daily.jsonl`). Experiment #1 (Bio 重写: 身份锚+硬证明+关注CTA) formally settled as **kept**: clean-traffic-day analysis (excluding the 2026-05-27 viral outlier and the 2026-05-23–26 impressions spike that inflated the baseline) shows conversion holding healthy at 36–48% on normal days, making the earlier -17% signal an artefact of baseline contamination rather than a real regression. Experiment #4 (置顶一条最强 thread) activated with an 8-day measurement window. `SCOREBOARD.md` regenerated: latest 7-day median conversion ratio 0.274, 90-day 0.333.

## [2026-06-10]

### Added

- **`wjs-cleaning-spam`** — new skill: cleans up 同城引流 spam replies (emoji-chain drain-account type) from 王建硕's X/Twitter posts. Because the X API block endpoint was removed (v2 returns code 34), the only programmatic weapons are **hide reply** (removes the reply from the thread for all non-author viewers) and **mute account** (suppresses future notifications). Workflow: (1) dry-run — outputs `flagged` and `borderline` JSON lists; (2) Claude manually reviews borderline entries to distinguish real comments from spam variants hiding invisible Unicode characters (U+034F, zero-width chars); (3) apply — hides + mutes the final confirmed set. State is stored in `state/cleaned.jsonl` so reruns are idempotent and rate-limit pauses (≈50 hides per 15 min) resume automatically. Covers the past 7 days only (X recent-search window limit). Ships a `scripts/clean_spam.py` with `--apply` and `--ids` flags. Triggers: `把这些spam删掉` / `清理X垃圾回复` / `推文下面好多引流号` / `clean spam replies` / `/wjs-cleaning-spam`.
- **README** — added `wjs-cleaning-spam` to the skills summary table and as a new subsection in section 10 "X 增长 / X Growth".

## [2026-06-09]

### Changed

- **`wjs-publishing-wechat` (STYLE.md)** — added three new formatting rules: (1) technical expressions and pseudocode (non-command forms such as `输出 = 函数（输入）` or `while true`) must use inline `` `code` `` — triple-backtick single-line wraps are explicitly banned because `md2wechat` renders them as empty `<code></code>` and the content is lost; (2) two or more parallel rhetorical questions inside a paragraph (e.g. "有什么工具？有什么 skill？") should be split into a `- ` bullet list, one question per item; (3) a rhetorical lead-in sentence that opens a new section (e.g. "那 Harness 是什么？") should stand alone as its own paragraph and be wrapped in `**bold**` to give readers a visible structural cue.

## [2026-06-08]

### Changed

- **`wjs-publishing-wechat` (scripts/gen-illustration.sh)** — illustration output is now always post-processed to a fixed 1024×576 (16:9) size: the image is first resampled to 1024 px wide (proportional), then center-cropped to 576 px tall. Previously the aspect ratio was model-chosen; now it is consistently 16:9.
- **`wjs-publishing-wechat` (STYLE.md)** — added a formatting rule for ordered lists with 10 or more items: use `<p>N. 内容</p>` instead of `<ol>`, because WeChat renders `<ol>` via CSS counters that only show single digits (10 appears as 0).

## [2026-06-07]

### Changed

- **`wjs-publishing-wechat` (STYLE.md)** — replaced the `**加粗**` (bold + red) emphasis convention with plain inline red: key conclusions and concept words are now marked with `<span style="color:#c0392b;">…</span>` (colour only, no bold). The section heading was renamed from "加粗加红" to "标红" to match. The 2–4 highlights-per-article rule and placement guidance (key conclusions, core concepts — not whole paragraphs or headings) are unchanged.

## [2026-06-05]

### Added

- **`wjs-polishing-x-engagement`** — new skill: rewrites a plain Chinese tweet into 2–3 high-engagement versions, each built on two building blocks — a **verified real fact** (looked up live via `web_search`, never fabricated) + an **engagement hook** (leaves a gap readers instinctively want to fill). Five hook types in the rotation: historical-pattern extrapolation (strongest), question, fill-in-the-blank, counter-intuitive reveal, and binary-choice. Style rules are strict: short, plain, conversational — no literary flourish, no filler adjectives. Every output includes a fact source line for the user to verify before posting; when a strong archival image exists `image_search` surfaces it. Triggers: `润色这条推` / `改写这条推文` / `让它更有互动` / `帮我把这条发得更好` / `/wjs-polishing-x-engagement`.
- **README** — added `wjs-polishing-x-engagement` to the skills summary table and as a new subsection in section 10 "X 增长 / X Growth".

## [2026-06-04]

### Added

- **`wjs-publishing-hugo`** — new skill: conversational Hugo blog backend. No CMS, no `/admin` page — tell Claude what to post and it edits `content/`, adds images, commits, pushes, and auto-deploys via the repo's existing CI. Ships `scripts/new-post.py` (generates correct front matter with timezone-aware dates, URL, and categories), `scripts/categories.sh` (lists existing categories to avoid duplicates and supports bulk rename/merge), `scripts/add-image.py` (places images under `static/uploads/<year>/`, auto-resizes above 2000 px), and `scripts/publish.sh`. Adapts to any Hugo repo's existing front matter conventions — reads a sample post before writing. Triggers: `发一篇博客` / `给 Hugo 加文章` / `博客后台` / `/wjs-publishing-hugo`.
- **`wjs-looping-feedback`** — new skill: installs a self-driving feedback loop into any website repo using only the repo owner's own GitHub Actions and auth (Pro/Max OAuth token or `ANTHROPIC_API_KEY` — no hosted service, no extra billing). A floating "提个建议" button lets allowlisted visitors submit suggestions as prefilled GitHub Issues; the `feedback.yml` workflow gates on the allowlist, invokes Claude Code to make the requested change per `.feedback/INSTRUCTIONS.md`, auto-commits to `main`, updates a `/_feedback` dashboard with every suggestion and its commit, and closes the issue. One-click revert via a `revert: #N` issue. Supports Hugo, Next.js, Astro, and static sites. Includes a note on the GitHub Pages `workflow_run` bridge needed when the deploy itself is a GitHub Actions workflow. Triggers: `给网站加个反馈对话框` / `提一句话就自动改网站` / `feedback loop` / `/wjs-looping-feedback`.
- **README** — added `wjs-publishing-hugo` and `wjs-looping-feedback` to the skills summary table; added dedicated sections (section 11 expanded to cover both Hugo blog skills, new section 12 for the feedback loop skill); section 11 renamed from "博客迁移 / Blog Migration" to "Hugo 博客 / Hugo Blog".

### Changed

- **`wjs-converting-wp-to-hugo`** — iterative refinements to the WordPress → Hugo migration pipeline (2 commits).

## [2026-06-03]

### Changed

- **`wjs-publishing-wechat`** — major structural refactor across 19 commits: (1) a new **`STYLE.md`** file extracted as the dedicated style-authority document for 王建硕's WeChat writing voice — covers the first principle (light polish, <5% edits), voice DNA (assertive conclusions, oral register preserved, AI referred to as "他" not "它", human-subject sentence preference), length constraints (800–1000 characters default, hard cap 1500), bold-red rules (2–4 `**...**` per article on key conclusions and concepts, never on whole paragraphs or headings), full typography guide (盘古之白, raw-HTML blockquote, fenced code blocks), paragraph-break rules, title/summary guidelines, and a 10-row "never do" red-line checklist; (2) **SKILL.md** restructured to focus exclusively on workflow and mechanism (scripts, image generation, HTML conversion, publishing steps) — all style decisions now delegate to STYLE.md, which wins in any conflict; (3) new **`scripts/open-draft-edit.sh`** script for opening a WeChat draft directly for editing; (4) iterative updates to `scripts/upload-draft.sh` and `scripts/publish.sh`; (5) skill-level README.md rewritten in Chinese.

## [2026-05-31]

### Changed

- **`wjs-syndicating-articles`** — X (Twitter) posting is now structurally skipped rather than conditionally skipped based on tweeting history. `syndicate.sh` always bypasses X, with an explicit comment noting it is "owned exclusively by `wjs-tweeting-from-articles`" — this prevents any risk of double-posting regardless of history state. Also migrated the `articles_dir` path and scheduler `WORKDIR` from the iCloud Documents location to `~/code/wechat-publish/`, and removed the now-obsolete `run-scheduled.sh.retired` file.

## [2026-05-30]

### Added

- **`wjs-converting-wp-to-hugo`** — new skill: migrates any WordPress site to a Hugo + Markdown + git static site deployed on GitHub Pages. Inputs are the WXR export (`.xml`) and the `wp-content/uploads/` folder — fully offline, zero third-party dependencies. Preserves `/archives/<id>/` URLs 100% so old links never break. Ships a TDD converter (`wxr_to_hugo.py` + `test_wxr.py`), a `verify_build.py` that asserts every old URL is present in the build, a hand-written minimal Hugo theme (CJK-friendly, zero submodules), and a GitHub Actions workflow. Security-first: WXR contains password-protected post bodies and author emails — `.gitignore` uses root-anchored patterns so sensitive files are never committed. Password-protected posts and scaffold pages always require explicit user decision before publishing. Triggers: `把 WordPress 迁成 Hugo` / `wordpress 转静态站` / `migrate WordPress to Hugo` / `WXR to Hugo` / `/wjs-converting-wp-to-hugo`.
- **README** — added `wjs-converting-wp-to-hugo` to the skills summary table and as new section 11 "博客迁移 / Blog Migration".

### Changed

- **`wjs-x-improving-content`** — state data refreshed: `state/tweets.jsonl` and `state/versions.jsonl` updated with latest tweet impression records; `state/SCOREBOARD.md` regenerated.

## [2026-05-28]

### Changed

- **`wjs-publishing-wechat`** — SKILL.md significantly condensed and streamlined across five iterative commits: verbose multi-bullet "不要做的事" list collapsed to a single inline rule; 盘古之白 section shortened (noting that `upload-draft.sh` already runs `pangu.py` automatically, so Claude doesn't need to); word-count script reformatted as a proper fenced code block; "介绍 skill 的文章：末尾必须附安装方法" section simplified from a per-platform table to a single agent-invocation instruction ("tell your AI agent to install the SKILL.md URL"); wording tightened throughout without changing any underlying capabilities or workflow steps.
- **`wjs-x-increasing-follower`** — daily analytics data ingested: `daily.jsonl` now includes 2026-05-27 (840 profile visits, 102 new follows, ratio 0.121). Experiment #1 (Bio rewrite) state updated with a note flagging the 2026-05-27 spike as an outlier viral day (a quoted-tweet drove anomalous curiosity traffic — ratio 0.121 is not a representative conversion signal; evaluation window extended by one day). After-value for Experiment #1 updated to the current live bio text. SCOREBOARD.md regenerated.

## [2026-05-27]

### Added

- **`wjs-x-increasing-follower`** — new skill: treats X follower growth as an engineering discipline with numbered A/B experiments. Every profile change is tracked with a hypothesis, a before-state for rollback, and a verdict measured against a north-star metric of new followers ÷ profile visits (conversion ratio) — immune to one-off viral traffic spikes. `daily-check.sh` ingests the X Analytics CSV export, scores running experiments, and surfaces keep / rollback recommendations (rollback always requires explicit user confirmation; never silently mutates bio). Triggers: `涨粉` / `X 涨粉实验` / `A/B 测我的 profile` / `今天的涨粉检查` / `/wjs-x-increasing-follower`.
- **`wjs-x-improving-content`** — new skill: treats X tweet quality as an engineering problem — iterates on `prompts/x/prompt.md`, attributes each tweet to the git-SHA-versioned prompt that generated it, and measures effectiveness by median impressions per mature tweet (≥3 days old). Content-feature analysis (angle / length / topic) is the most actionable signal for prompt edits; version comparisons give directional guidance only (≥5 mature tweets per version required before a verdict). Data comes from the X Analytics Content CSV export (`inbox/` directory). Paired companion to `wjs-x-increasing-follower`: that one optimises profile→follow conversion; this one optimises prompt→impression. Triggers: `改 X 的 prompt` / `X 内容改进` / `哪版 prompt 最好` / `/wjs-x-improving-content`.
- **README** — added `wjs-x-increasing-follower` and `wjs-x-improving-content` to the skills summary table and as new section 10 "X 增长 / X Growth".

### Changed

- **`wjs-publishing-wechat`** — iterative content updates.
- **`wjs-tweeting-from-articles`** — iterative workflow updates.
- **`wjs-syndicating-articles`** — iterative update.

## [2026-05-26]

### Changed

- **`wjs-tweeting-from-articles`** — continued iterative workflow refinements across the day: further updates to article-selection logic, scheduling, and tweet-generation flow. (7 commits, including a handful dated 2026-05-27 in UTC.)
- **`wjs-editing-multicam`** — iterative update to the polysync-driven multicam edit pipeline.
- **`wjs-overlaying-video`** — three iterative updates to the HyperFrames-based post-production overlay workflow.
- **`wjs-uploading-video`** — minor update to the YouTube upload flow.

## [2026-05-25]

### Changed

- **`wjs-syncing-multicam`** — implementation migrated to the open-source **`polysync`** pip package (`pip install polysync`; driven via `polysync sync` / `polysync verify`). Added multi-probe drift detection with linear fit — corrects 5–50 ppm clock drift between cameras over long shoots. Added auto-selection of the loudest audio stream per file, handling Sony FX6 MXF clips where `a:0`/`a:1` are silent and the room mic sits on `a:2`/`a:3`. Reference input now also receives a `.sync.json` sidecar (`delta_seconds: 0`) so downstream tools can treat all inputs uniformly.
- **`wjs-editing-multicam`** — implementation migrated to `polysync` (`polysync edit` builds the decision list; `polysync render-cuts` / `render-pip` render). New render flags: `--log slog3` (S-Log3 → Rec.709 LUT applied after downscale for speed); `--rotate N:DEG` (per-cam rotation for physically-tilted cameras without a rotation flag); `--width`/`--height`/`--fill` (vertical output for 小红书/Shorts/Reels); `--duck-audio` + `--audio-cams` (speaker-gated multi-mic mix — keeps the active speaker's close mic and ducks the rest, replacing the single-cam soundtrack with a much cleaner signal). Added detailed preflight checklist covering color profile, orientation check, and delivery format. Documented per-mic baseline-normalized speaker attribution and deliberate cutaway injection for richer cut logic beyond raw energy-switching.
- **`wjs-tweeting-from-articles`** — added batch scheduling mode: enqueue multiple articles at once and auto-post at a configurable interval (every N hours). Updated `pick-next-article.sh` selection logic; cleared stale state files (`today-angle.txt`, `today-tweet.txt`). Continued iterative workflow refinements.
- **`wjs-transcribing-audio`** — hardened the Whisper path: explicit 10-min chunking at 64 kbps mono MP3 for resilience under flaky proxies; added offline local `openai-whisper` (medium model) as a quality-floor fallback when no API access is available; tightened guidance on never using `response_format=srt` — always request word-level timestamps and assemble cues with the punctuation-aware assembler. Continued iterative routing improvements.
- **`wjs-publishing-wechat`** — added **加粗加红** enforcement rule: every article must contain 2–4 `**bold**` spans (rendered as red `<strong>` by `upload-draft.sh`), placed on key conclusions and core concept words — never on whole paragraphs or transitions. Zero instances = article is not finished. Also enforced 盘古之白 (space between CJK and Latin/digit runs).
- **`wjs-converting-text-to-video`** — iterative update to the daily upload batch script.
- **README** — updated `wjs-syncing-multicam` and `wjs-editing-multicam` sections to reference the `polysync` package, the drift-correction approach, and new render flags (log grading, rotation, vertical output, speaker-gated audio); updated `wjs-publishing-wechat` to document the 加粗加红 requirement; updated `wjs-tweeting-from-articles` to note batch scheduling mode.

## [2026-05-24]

### Added

- **`wjs-mining-articles`** — new skill: turns a video's SRT into multiple standalone 微信公众号 articles. Reads the transcript, identifies 2–6 distinct topics (or more for long interviews), polishes each into an 800–1000-word article in 王建硕's natural written voice, creates WeChat drafts, and optionally queues posts to X. Supports both monologue and interview/dialogue sources — for interviews Claude asks the user to confirm which speaker is 王建硕 before extracting his perspective, and automatically skips mic-check chatter, setup banter, and off-camera breaks. Triggers: `把这个视频写成文章` / `从字幕里挖文章` / `这个 SRT 能写几篇` / `把对谈写成文章` / `/wjs-mining-articles <srt>`.
- **README** — added `wjs-mining-articles` to the skills summary table and as a new subsection in section 1 "公众号 / WeChat".

### Changed

- **`wjs-syndicating-articles`** — iterative workflow refinements (38 commits across the day, consolidating scripts and edge-case handling).
- **`wjs-publishing-wechat`** — minor wording fix in the formatting section; further iterative content updates.
- **`wjs-tweeting-from-articles`** — updated `pick-next-article.sh`; cleared stale state files (`today-angle.txt`, `today-tweet.txt`); further iterative updates.
- **`wjs-transcribing-audio`** — multiple iterative updates to transcription routing and SRT assembly.
- **`wjs-overlaying-video`** — extensive iterative updates to the HyperFrames-based post-production workflow and overlay logic.
- **`wjs-segmenting-video`** — workflow refinements to the topic-boundary detection and clip-extraction pipeline.
- **`wjs-reframing-video`** — workflow refinements to the speaker-tracking crop logic.
- **`wjs-converting-text-to-video`** — updated `daily-upload-batch.sh` upload script.

## [2026-05-23]

### Added

- **`wjs-syndicating-articles`** — new skill: syndicates the latest unpublished 微信公众号 article across social platforms in one run. Extracts a ≤120-character core copy, then posts to API platforms (X / Bluesky / Threads / LinkedIn) when credentials exist and writes a copy-paste outbox (`outbox/<date>-<slug>/`) for manual platforms (Facebook / 小红书 / 即刻 / 知乎). Fully idempotent via `state/history.jsonl` — re-runs only retry platforms that didn't succeed. Missing or expired credentials auto-degrade to the outbox without failing other platforms. Supports `--dry-run`, `--open`, and `--mark <slug> <platform>`. Triggers: `分发文章到各平台` / `同步到社交平台` / `今天的文章发各平台` / `/wjs-syndicating-articles`.
- **README** — added `wjs-syndicating-articles` to the skills summary table and as a new subsection in section 6 "分发 / 上传 / 推广".

### Changed

- **`wjs-publishing-wechat`** — added two new formatting sections: (1) **加粗加红**: every article must include 2–4 `**bold**` spans, rendered as red by `upload-draft.sh`; placed on key conclusions / core concept words, never on whole paragraphs or transitions; (2) **命令/代码**: standalone commands must be formatted as full code blocks (淡底色 HTML `<section>` or fenced `bash` block), not inline code.

## [2026-05-21]

### Removed

- **`wjs-picking-comments`** — retired the dedicated comment-picking skill. The 上篇精选留言 footer idea didn't pan out; the skill and all its scripts (`build-footer.py`, `capture-comment-url.sh`, `fetch-latest-from-rss.py`, `inject-footer.py`, `select-elected-comments.py`) have been deleted.

### Changed

- **`wjs-publishing-wechat`** — removed Step 5.5 (the 精选留言 footer integration step) from the publishing workflow now that `wjs-picking-comments` is gone. The `discover-prev-elected.sh` script reference and related "Done When" checklist item were removed. The workflow summary now goes directly from cover/illustration generation (step 7) to outputting publish instructions (step 8). Minor wording cleanup in the Raw HTML 块透传 description (example updated from "上篇精选 footer" to generic "引用/注释卡片").

## [2026-05-20]

### Added

- **`wjs-teaching-english`** — new skill: turns a single English word into a self-contained HLS "supercut" lesson built from the mira video base. Stitches every season2 clip where the word is spoken (via the search-app `/api/playlist`, COS URLs) into one `.m3u8`, prepended with a bilingual word-intro card (word + IPA + 中文 gloss + usage, Volcano TTS) and appended with a 关注王建硕 CTA card. No MP4 is burned — only the two cards are rendered as small `.ts` files, encoded to match the supercut's codec/fps so the first HLS discontinuity needs no decoder re-init. Triggers: `teach <word>` / `讲讲 <word>` / `学英语 <word>` / `把 <word> 做成视频` / `/wjs-teaching-english <word>`.
- **README** — added `wjs-teaching-english` to the skills summary table and added new section 7 "英语教学 / English Teaching"; renumbered former sections 7–8 to 8–9.

## [2026-05-18]

### Added

- **`wjs-converting-text-to-video`** — new skill: turns a 王建硕-style WeChat `article.md` into a narrated portrait video (1080×1920, 30–90 s). Full 9-step pipeline: (1) split article into 5–10 visual scenes using a 16-template mix (Hero / Contrast / List / Stat / Quote / Geometric); (2) enforce Scene Mix Rule (≥4 template types, ≥1 color-flip, font-size span ≥240 px, ≥2 rhythm switches); (3) write narration chunks; (4) TTS via Volcano 火山引擎 (default: 阿虎对话 `zh_male_ahu_conversation_wvae_bigtts`, with documented backup voices); (5) generate abstract watercolor background with GPT Image 2 (6 themes: tech / personal / reflection / warning / growth / abstract); (6) author HyperFrames CSS/GSAP `index.html` with ≥3 Modern Motion Techniques (kinetic typography, mask reveal, number ticker, etc.); (7) add SFX (tick/chime/bell); (8) lint → inspect → render via HyperFrames CLI; (9) daily-cron upload to YouTube (portrait → Shorts). Triggers: "把这篇文章做成视频" / "做一个解说视频" / "讲解视频" / `/wjs-converting-text-to-video`.
- **README** — added `wjs-converting-text-to-video` to skills table and as new section 2 "文章转视频 / Article to Video"; renumbered subsequent sections 2–7 → 3–8; added article-to-video entry in the 典型工作流串接 pipeline diagrams.

## [2026-05-17]

### Changed

- **`wjs-publishing-wechat`** — Scripts reorganized into a `scripts/` subdirectory (gen-cover-ai.sh, gen-illustration.sh, publish.sh, upload-draft.sh moved); two new comment-fetching scripts added: `fetch-comments.sh` (API-based) and `fetch-comments-by-cookie.sh` (browser-cookie auth, no API key needed); `mass-send.sh` added for batch messaging; `upload-draft.sh` substantially expanded. Installation instructions in skill-promo articles simplified: replaced the per-platform `cp -r` command table with a single "tell your AI agent to install the SKILL.md URL" instruction (agent installs it natively; Hermes gets its own one-liner). `## 后注` is no longer a default article section — it's opt-in only for genuine footnotes. Illustration placement logic updated to match.
- **`wjs-eating-and-growing`** — Skill description made fully user-agnostic ("帮用户" not "帮王建硕"). Step 3 renamed from "旧权重" to "旧参数" throughout — a terminology clarification that makes the distinction from Step 4's "新参数" cleaner. Removed attribution to Mars 任鑫 from the framework table. Refined example prompts in Steps 1 and 2.
- **`wangjianshuo-perspective`** — Minor style refinement in the out-of-scope handling note: removed the illustrative "correct me if I am wrong" phrase (the broader guidance still instructs Claude to handle uncertainty with humility).

## [2026-05-16]

### Changed

- **`wangjianshuo-perspective`** — added three new expression constraints to the bilingual style guide: (1) **惜字如金** (brevity): short is always the default — if removing a sentence loses nothing, cut it; (2) **平** (plainness): explicit small-word examples, e.g. prefer "用" over "使用", "想" over "思考"; (3) **不用反问句** (no rhetorical questions): say "this is wrong" directly rather than "isn't this wrong?" — genuine open questions are fine, rhetorical装腔 ones are not. The "绝不做的" (never-do) list updated to include all three constraints.
- **`wjs-eating-and-growing`** — added a full worked example (朋友群约吃饭 scenario) showing what a complete 5-line output looks like in practice, plus a 4-step "why" ladder so both users and Claude can verify that each row genuinely answers the row above it.
- **`wjs-publishing-wechat`** — multiple iterative content updates.
- **`.claude` settings** — disabled background worktree isolation for this repo.

## [2026-05-15]

### Changed

- **`wjs-eating-and-growing`** — expanded from 4 steps to 5. The new fifth step separates "旧权重 (old pattern)" from "新参数 (new parameter)": users now explicitly name the entrenched interpretation pattern they're overwriting (Step 3) before defining the replacement response mode (Step 4), making the L3-weight update more precise. Final output block is now 5 lines: 堑 / 自动输出 / 旧权重 / 新参数 / 下次的那一秒.
- **`wjs-publishing-wechat`** — multiple iterative content updates (exact scope tracked in skill directory).
- **README** — updated `wjs-eating-and-growing` entry from 4-step to 5-step description throughout skills table and dedicated section.

## [2026-05-14]

### Added

- **`wangjianshuo-perspective`** — new skill: distilled thinking OS for Wang Jianshuo (王建硕). Synthesised from ~1M-word English blog + ~1.09M-word Chinese blog (2002–2022). Activates on triggers like "用王建硕的视角" / "Jian Shuo Wang perspective" / "切换到王建硕"; Claude then speaks directly as Wang Jianshuo until the user says "退出". Includes 7 core mental models, 10 decision heuristics, and bilingual voice guidelines.
- **`wangjianshuo-perspective/yuanqi-prompt.md`** — condensed (~4000-char) version of the persona prompt for the 元器 (Yuanqi) platform, with example title-generation outputs and intellectual-lineage context.

### Changed

- **`wjs-eating-and-growing`** — simplified from 6 steps to 4: the framework now runs ① capture the hot moment → ② root cause → ③ one-line insight → ④ minimum next action. Dropped the layer-diagnosis and fire-test as separate steps; the L1/L2/L3 model is still the conceptual backbone but no longer a user-facing prompt step.
- **`wjs-publishing-wechat`** — iterative content update (exact changes tracked in skill directory).
- **README** — added Claude Code install instructions (npm / npx / native-installer paths); added `wangjianshuo-perspective` to skills table and dedicated section.

## [2026-05-13]

### Added

- **`wjs-eating-and-growing`** — new skill: 6-step interactive reflection framework ("吃一舍长一智"). Diagnoses which of three layers (L1 knowledge gap / L2 in-the-moment retrieval / L3 default reaction) caused a setback, then prescribes the right training modality for that layer. Replaces the earlier `eat-grow` skill.
- **`.claude-plugin/marketplace.json`** — the repo is now installable as a Claude Code marketplace plugin (`claude plugin marketplace add jianshuo/claude-skills`).
- **`LICENSE`** — MIT licence added.

### Changed

- **`wjs-prompting-skills` renamed to `wjs-promoting-skills`** — the skill is about *marketing / promoting* skills externally (X posts, community drafts), not about prompting. Name corrected to remove ambiguity.
- **`wjs-promoting-skills`** — multiple iterative improvements to the daily automation flow, rotation rules, X post format constraints, and community-draft templates.
- **README** — documented three install paths (ClawHub / marketplace / git clone) and added a compatibility section listing Claude Code, OpenAI Codex CLI, Cursor, Gemini CLI, and Goose.

## [2026-05-12]

### Changed

- **Renamed all skills to V-ing (gerund) convention** — skill directories now describe *what action is happening*, which aligns with Claude Code's auto-loading trigger logic. Mapping:
  - `wjs-burn-subs` → `wjs-burning-subtitles`
  - `wjs-transcribe` → `wjs-transcribing-audio`
  - `wjs-translate-srt` → `wjs-translating-subtitles`
  - `wjs-dub` → `wjs-dubbing-video`
  - `wjs-video-overlay` → `wjs-overlaying-video`
  - `wjs-video-segmentation` → `wjs-segmenting-video`
  - `wjs-translate-video` → `wjs-localizing-video`
  - `wjs-wechat-publish` → `wjs-publishing-wechat`
  - `wjs-video-upload` → `wjs-uploading-video`
  - `wjs-make-it-right` → `wjs-auditing-project`
  - `wjs-multicam-edit` → `wjs-editing-multicam`
  - `wjs-multicam-sync` → `wjs-syncing-multicam`
  - `wjs-video-crop` → `wjs-reframing-video`
- **README rewritten** with updated skill names, improved catalog table, grouped workflow sections, and end-to-end pipeline diagrams.
- **`wjs-publishing-wechat`**: Cover image (题图) is now always AI-generated. Removed the interactive prompt that asked the user to choose a cover option.

### Updated (skill content)

- `wjs-publishing-wechat` — multiple iterative improvements throughout the day.
- `wjs-overlaying-video` — content updates.
- `wjs-segmenting-video` — content updates.
- `wjs-localizing-video` — content updates.
- `wjs-burning-subtitles` — content updates.
- `wjs-dubbing-video` — content updates.
- `wjs-translating-subtitles` — content updates.
- `wjs-transcribing-audio` — content updates.
- `wjs-uploading-video` — content updates.
