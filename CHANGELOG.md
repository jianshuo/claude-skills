# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [2026-05-24]

### Changed

- **`wjs-syndicating-articles`** — iterative workflow refinements (38 commits across the day, consolidating scripts and edge-case handling).
- **`wjs-publishing-wechat`** — minor wording fix in the formatting section.
- **`wjs-tweeting-from-articles`** — updated `pick-next-article.sh`; cleared stale state files (`today-angle.txt`, `today-tweet.txt`).
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
